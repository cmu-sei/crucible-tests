// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, BLUEPRINT_THEMES, applyBlueprintTheme } from '../../fixtures';
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

    // Unique per run so concurrent specs/runs never collide, and so a mid-test failure's
    // leftovers don't need a name-based pre-cleanup pass — the teardown purge sweeps rows
    // matching tempBlueprintName()'s shape automatically.
    let CATALOG_NAME: string;
    let INJECT_TYPE_NAME: string;

    test.beforeEach(async () => {
      CATALOG_NAME = tempBlueprintName('CopyCat');
      INJECT_TYPE_NAME = tempBlueprintName('CopyCatIT');
      // Preconditions over the API, inside the lock the first beforeEach took (every create
      // broadcasts to open admin pages). Only the copy goes through the UI.
      const token = await getBlueprintToken();
      const injectType = await createInjectType(token, { name: INJECT_TYPE_NAME });
      await createCatalog(token, { name: CATALOG_NAME, injectTypeId: injectType.id });
    });

    // Cleanup runs in afterEach (never inline at the end of the test body) so a mid-test
    // failure still cleans up. Catalogs are deleted before inject types: deleting an
    // inject type CASCADE-DELETES every catalog that still references it.
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
          // The copy operation appends " - <username>" to the copied catalog's name, so
          // match by prefix to also delete the copy, not just the original.
          if (record.name === name || record.name.startsWith(`${name} - `)) {
            await fetch(`${Services.Blueprint.API}${endpoint}/${record.id}`, {
              method: 'DELETE',
              headers,
            });
          }
        }
      }
    });

    test('Copy Catalog', async ({ blueprintAuthenticatedPage: page }) => {
    await applyBlueprintTheme(page, theme);
      await page.goto(`${Services.Blueprint.UI}/admin`);
      await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

      // Helper: navigate to a section via the sidebar mat-list-item
      const navigateTo = async (section: string) => {
        const navItem = page.locator(`mat-list-item:has-text("${section}")`).first();
        await expect(navItem).toBeVisible({ timeout: 5000 });
        await navItem.click();
        await expect(
          page.locator(`h1:has-text("${section}"), h2:has-text("${section}"), [class*="title"]:has-text("${section}"), mat-toolbar:has-text("${section}")`).first()
        ).toBeVisible({ timeout: 5000 });
      };

      // ── Step 1/2: the Inject Type and Catalog were seeded in beforeEach ─────

      await navigateTo('Catalogs');

      // The Catalogs list paginates (20/page); a freshly-created catalog can land on
      // page 2+ once enough rows exist. Type the unique name into the list's own Search
      // box so the filtered dataset collapses onto page 1 before counting rows.
      const searchBox = page.locator('input[placeholder*="Search"]').first();
      await expect(searchBox).toBeVisible({ timeout: 5000 });
      await searchBox.fill(CATALOG_NAME);

      // Record the count of rows carrying this spec's catalog name before copy (starts
      // at 1: the original). Scoped by name, not the whole (shared, concurrently-mutated)
      // table, so a sibling spec creating/deleting its own catalog can't shift this count.
      const catalogNameRows = page.locator('mat-row, tr[mat-row]').filter({ hasText: CATALOG_NAME });
      await expect(catalogNameRows).toHaveCount(1);

      // ── Step 3: Copy the catalog ─────────────────────────────────────────────

      const copyButton = page.getByRole('button', { name: new RegExp(`^Copy ${CATALOG_NAME}`) }).first();
      await expect(copyButton).toBeVisible({ timeout: 5000 });
      await copyButton.click();

      // AdminCatalogListComponent.copyCatalog() always opens a confirm dialog
      // ("Are you sure that you want to copy <name>?") before calling the copy API —
      // it is not conditional, so assert it rather than probing with a soft check.
      const confirmDialog = page.locator('[role="dialog"], .mat-dialog-container, [class*="dialog"]').first();
      await expect(confirmDialog).toBeVisible({ timeout: 5000 });
      const confirmButton = confirmDialog.getByRole('button', { name: 'Yes' });
      await expect(confirmButton).toBeVisible({ timeout: 5000 });
      const copyResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          /^\/api\/catalogs\/[^/]+\/copy$/.test(new URL(response.url()).pathname),
        { timeout: 15000 }
      );
      await confirmButton.click();
      expect((await copyResponse).ok(), 'copy catalog response').toBeTruthy();

      // ── Step 4: Verify the copy exists (original + copy = 2 rows for this name) ──

      // CatalogService.privateCatalogCopyAsync appends " - <username>" to the copy's
      // name, so it still contains CATALOG_NAME and this filtered locator picks it up.
      await expect(catalogNameRows).toHaveCount(2, { timeout: 10000 });
    });
    });
}