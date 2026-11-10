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

    // Unique per run so concurrent runs / leftovers from an interrupted prior run never
    // collide, and the teardown purge auto-sweeps by the tempBlueprintName shape.
    let CATALOG_NAME: string;
    let INJECT_TYPE_NAME: string;

    test.beforeEach(async () => {
      CATALOG_NAME = tempBlueprintName('ExpandCat');
      INJECT_TYPE_NAME = tempBlueprintName('ExpandCatIT');
      // Preconditions over the API, inside the lock the first beforeEach took (every create
      // broadcasts to open admin pages). Only the expand/collapse goes through the UI.
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

    test('Expand Catalog to View Injects', async ({ blueprintAuthenticatedPage: page }) => {
    await applyBlueprintTheme(page, theme);
      await page.goto(`${Services.Blueprint.UI}/admin`);
      await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

      // Helper: navigate to a section via the sidebar
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

      // ── Step 3: Expand and collapse this spec's own catalog row ──────────────

      // Filter the Catalogs list down to this spec's own row via the section's own
      // Search box. The Catalogs table is shared with concurrently-running specs, and
      // paginates (20/page); once enough catalogs exist, this spec's row can land off
      // page 1. Filtering also collapses the list to a single row, so a positional
      // `.first()` below can only ever resolve to this spec's own row.
      const searchBox = page.locator('input[placeholder*="Search"]').first();
      await expect(searchBox).toBeVisible({ timeout: 5000 });
      await searchBox.fill(CATALOG_NAME);

      const catalogRow = page
        .getByRole('button', { name: `Edit ${CATALOG_NAME} catalog` })
        .locator('xpath=ancestor::mat-row[1]');
      const detailRow = catalogRow.locator('xpath=following-sibling::mat-row[contains(@class, "detail-row")][1]');
      const expandedContent = detailRow.locator('mat-expansion-panel').filter({ hasText: 'Injects' });

      // 1. Click on the catalog row to expand it. AdminCatalogListComponent's mat-table
      // has no trackBy, and every catalog/inject-type mutation on the shared admin stack
      // broadcasts over SignalR to every open admin session (Blueprint.Api
      // Hubs/MainHub.cs AdminDataGroup) — a sibling spec's unrelated mutation running
      // concurrently at --workers 2 can force a full-table re-render between the click
      // and the assertion below. Retry the click+verify as a unit so a re-render landing
      // mid-sequence self-heals instead of failing the test.
      await expect(async () => {
        await expect(catalogRow).toBeVisible({ timeout: 3000 });
        if (!(await expandedContent.isVisible().catch(() => false))) {
          await catalogRow.click({ timeout: 3000 });
        }
        // expect: The row expands to show the Injects expansion panel for that catalog
        await expect(expandedContent).toBeVisible({ timeout: 3000 });
      }).toPass({ timeout: 30000 });

      // 2. Click the same row again to collapse it
      await expect(async () => {
        if (await expandedContent.isVisible().catch(() => false)) {
          await catalogRow.click({ timeout: 3000 });
        }
        // expect: The row collapses (expanded content is no longer visible). The
        // detailExpand animation drives this via a CSS state change (visibility:
        // hidden), not removal from the DOM, so `.not.toBeVisible()` on the same
        // locator is the correct real assertion — no swallow needed.
        await expect(expandedContent).not.toBeVisible({ timeout: 3000 });
      }).toPass({ timeout: 30000 });
    });
    });
}