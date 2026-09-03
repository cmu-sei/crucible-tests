// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getBlueprintToken, tempBlueprintName,
  acquireAdminCatalogLock,
  releaseAdminCatalogLock,
} from '../../test-helpers';

test.describe('Admin - Inject Types and Catalogs Management', () => {
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

  test.beforeEach(() => {
    CATALOG_NAME = tempBlueprintName('CopyCat');
    INJECT_TYPE_NAME = tempBlueprintName('CopyCatIT');
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

    // ── Step 1: Create a prerequisite Inject Type ────────────────────────────

    await navigateTo('Inject Types');

    const addInjectTypeButton = page.locator(
      'button[title*="Add"], button[aria-label*="Add"]'
    ).first();
    await expect(addInjectTypeButton).toBeVisible({ timeout: 5000 });
    await addInjectTypeButton.click();

    const injectTypeNameField = page.locator(
      'input[formControlName="name"], input[placeholder*="Name"]'
    ).first();
    await expect(injectTypeNameField).toBeVisible({ timeout: 5000 });
    await injectTypeNameField.fill(INJECT_TYPE_NAME);

    const injectTypeDescField = page.locator(
      'textarea[formControlName="description"], textarea[placeholder*="Description"], input[placeholder*="Description"]'
    ).first();
    await expect(injectTypeDescField).toBeVisible({ timeout: 5000 });
    await injectTypeDescField.fill('Test inject type for copy catalog test');

    const injectTypeSaveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    ).first();
    await expect(injectTypeSaveButton).toBeEnabled({ timeout: 5000 });
    await injectTypeSaveButton.click();

    const createdInjectType = page.locator(`text=${INJECT_TYPE_NAME}`).first();
    await expect(createdInjectType).toBeVisible({ timeout: 10000 });

    // ── Step 2: Navigate to Catalogs and create this spec's catalog ──────────

    await navigateTo('Catalogs');

    const addCatalogButton = page.locator(
      'button[title*="Add new Catalog"], button[title*="Add Catalog"]'
    ).first();
    await expect(addCatalogButton).toBeVisible({ timeout: 5000 });
    await addCatalogButton.click();

    // Fill Name
    const catalogNameField = page.locator('input[placeholder*="Name"]').first();
    await expect(catalogNameField).toBeVisible({ timeout: 5000 });
    await catalogNameField.fill(CATALOG_NAME);

    // Fill Description (required)
    const catalogDescField = page.locator(
      'input[placeholder*="Description"], textarea[placeholder*="Description"]'
    ).first();
    await expect(catalogDescField).toBeVisible({ timeout: 5000 });
    await catalogDescField.fill('Test catalog for copy test');

    // Select Inject Type (required) — pick this spec's own inject type by name, not
    // whichever option happens to render first. The option list is global across
    // concurrently-running specs; picking blindly binds this catalog to a sibling
    // spec's inject type, and that sibling's teardown CASCADE-DELETEs this catalog
    // the moment it deletes its own inject type.
    const injectTypeCombobox = page.getByRole('combobox', { name: /Inject Type/i }).first();
    await expect(injectTypeCombobox).toBeVisible({ timeout: 5000 });
    await injectTypeCombobox.click();
    const injectTypeOption = page
      .locator('mat-option, [role="option"]')
      .filter({ hasText: INJECT_TYPE_NAME });
    await expect(injectTypeOption).toBeVisible({ timeout: 5000 });
    await injectTypeOption.click();

    // Save the catalog
    const catalogSaveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
    await expect(catalogSaveButton).toBeEnabled({ timeout: 5000 });
    await catalogSaveButton.click();

    // Verify the catalog was created
    const createdCatalog = page.locator(`text=${CATALOG_NAME}`).first();
    await expect(createdCatalog).toBeVisible({ timeout: 10000 });

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
