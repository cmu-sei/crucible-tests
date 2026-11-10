// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, BLUEPRINT_THEMES, applyBlueprintTheme } from '../../fixtures';
import { readFileSync } from 'fs';
import { getBlueprintToken, tempBlueprintName,
  createInjectType,
  createCatalog,
  acquireAdminCatalogLock,
  releaseAdminCatalogLock,
} from '../../test-helpers';

for (const theme of BLUEPRINT_THEMES) {
    test.describe(`${theme} theme › Admin - Inject Types and Catalogs Management`, () => {
    // Serialize access to the shared admin Catalogs / Inject Types pages: they are not
    // safely concurrent (one unfiltered global inject store shared by an
    // app-inject-list mounted per row). See acquireAdminCatalogLock in test-helpers.
    test.beforeEach(async () => {
      await acquireAdminCatalogLock();
    });

    test.afterEach(async () => {
      await releaseAdminCatalogLock();
    });

    // Unique per run so concurrent runs / leftovers from an interrupted prior run never
    // collide, and the teardown purge auto-sweeps by the tempBlueprintName shape.
    let CATALOG_NAME: string;
    let INJECT_TYPE_NAME: string;

    test.beforeEach(async () => {
      CATALOG_NAME = tempBlueprintName('DownloadCat');
      INJECT_TYPE_NAME = tempBlueprintName('DownloadCatIT');
      // Preconditions over the API, inside the lock the first beforeEach took (every create
      // broadcasts to open admin pages). Only the download goes through the UI.
      const token = await getBlueprintToken();
      const injectType = await createInjectType(token, { name: INJECT_TYPE_NAME });
      await createCatalog(token, { name: CATALOG_NAME, injectTypeId: injectType.id });
    });

    // Cleanup runs in afterEach (not inline at the end of the test body) so a mid-test
    // failure still deletes what this test created. Catalogs are deleted before inject
    // types: deleting an inject type CASCADE-DELETES every catalog that still references it.
    test.afterEach(async () => {
      const token = await getBlueprintToken();
      const headers = { Authorization: `Bearer ${token}` };

      for (const [endpoint, name] of [
        ['/api/catalogs', CATALOG_NAME],
        ['/api/injectTypes', INJECT_TYPE_NAME],
      ] as const) {
        const response = await fetch(`${Services.Blueprint.API}${endpoint}`, { headers });
        if (!response.ok) continue;

        for (const record of (await response.json()) as Array<{ id: string; name: string }>) {
          if (record.name === name) {
            await fetch(`${Services.Blueprint.API}${endpoint}/${record.id}`, {
              method: 'DELETE',
              headers,
            });
          }
        }
      }
    });

    test('Download Catalog as JSON', async ({ blueprintAuthenticatedPage: page }) => {
    await applyBlueprintTheme(page, theme);
      await page.goto(`${Services.Blueprint.UI}/admin`);
      await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

      // Helper: navigate to a section via the sidebar
      const navigateTo = async (section: string) => {
        const navItem = page.locator(`mat-list-item:has-text("${section}")`).first();
        await expect(navItem).toBeVisible({ timeout: 5000 });
        await navItem.click();
        // Wait for the section heading or content to be visible
        await expect(page.locator(`h1:has-text("${section}"), h2:has-text("${section}"), [class*="title"]:has-text("${section}"), mat-toolbar:has-text("${section}")`).first()).toBeVisible({ timeout: 5000 });
      };

      // ── Step 1/2: the Inject Type and Catalog were seeded in beforeEach ─────

      await navigateTo('Catalogs');

      // The Catalogs list paginates (20/page), so filter to this spec's catalog first.
      const searchBox = page.locator('input[placeholder*="Search"]').first();
      await expect(searchBox).toBeVisible({ timeout: 5000 });
      await searchBox.fill(CATALOG_NAME);
      await expect(page.getByRole('button', { name: `Edit ${CATALOG_NAME} catalog` })).toBeVisible({
        timeout: 10000,
      });

      // ── Step 3: Download the newly created catalog ───────────────────────────

      // 13. Set up the download promise before clicking to avoid race conditions
      const downloadPromise = page.waitForEvent('download');

      // 14. Click the download button for the newly created catalog
      const downloadButton = page.getByRole('button', { name: new RegExp(`^Download ${CATALOG_NAME}`) }).first();
      await expect(downloadButton).toBeVisible({ timeout: 5000 });
      await downloadButton.click();

      // expect: A JSON file is downloaded named '{catalogName}-catalog.json'
      const download = await downloadPromise;
      const filename = download.suggestedFilename();
      expect(filename).toMatch(/.*catalog.*\.json$/i);

      // expect: The file contains valid catalog JSON data
      const downloadPath = await download.path();
      if (downloadPath) {
        const content = readFileSync(downloadPath, 'utf-8');
        const data = JSON.parse(content);
        expect(data).toBeDefined();
      }

      // Cleanup happens in afterEach (via the API) so a mid-test failure still cleans up.
    });
    });
}