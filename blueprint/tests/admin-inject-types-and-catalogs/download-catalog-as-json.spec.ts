// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { readFileSync } from 'fs';
import { getBlueprintToken, tempBlueprintName } from '../../test-helpers';

test.describe('Admin - Inject Types and Catalogs Management', () => {
  // Unique per run so concurrent runs / leftovers from an interrupted prior run never
  // collide, and the teardown purge auto-sweeps by the tempBlueprintName shape.
  let CATALOG_NAME: string;
  let INJECT_TYPE_NAME: string;

  test.beforeEach(() => {
    CATALOG_NAME = tempBlueprintName('DownloadCat');
    INJECT_TYPE_NAME = tempBlueprintName('DownloadCatIT');
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

    // ── Step 1: Create a prerequisite Inject Type ────────────────────────────

    await navigateTo('Inject Types');

    // 3. Click add button to create a new inject type
    const addInjectTypeButton = page.locator(
      'button[title*="Add"], button[aria-label*="Add"]'
    ).first();
    await expect(addInjectTypeButton).toBeVisible({ timeout: 5000 });
    await addInjectTypeButton.click();

    // 4. Fill in the inject type name
    const injectTypeNameField = page.locator(
      'input[formControlName="name"], input[placeholder*="Name"]'
    ).first();
    await expect(injectTypeNameField).toBeVisible({ timeout: 5000 });
    await injectTypeNameField.fill(INJECT_TYPE_NAME);

    // 5. Fill in the inject type description (required for Save to enable)
    const injectTypeDescField = page.locator(
      'input[formControlName="description"], input[placeholder*="Description"], textarea[placeholder*="Description"]'
    ).first();
    await expect(injectTypeDescField).toBeVisible({ timeout: 5000 });
    await injectTypeDescField.fill('Test inject type description');

    // 6. Save the inject type
    const injectTypeSaveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    ).first();
    await expect(injectTypeSaveButton).toBeEnabled({ timeout: 5000 });
    await injectTypeSaveButton.click();

    // expect: The inject type appears in the list
    await expect(page.locator(`text=${INJECT_TYPE_NAME}`).first()).toBeVisible({ timeout: 10000 });

    // ── Step 2: Create Catalog ───────────────────────────────────────────────

    // 7. Navigate to Catalogs section
    await navigateTo('Catalogs');

    // 8. Click the add catalog button
    const addCatalogButton = page.getByRole('button', { name: 'Add new Catalog' });
    await expect(addCatalogButton).toBeVisible({ timeout: 5000 });
    await addCatalogButton.click();

    // 9. Fill in catalog name
    const nameField = page.locator('input[placeholder*="Name"]').first();
    await expect(nameField).toBeVisible({ timeout: 5000 });
    await nameField.fill(CATALOG_NAME);

    // 10. Fill in catalog description
    const descField = page.locator(
      'input[placeholder*="Description"], textarea[placeholder*="Description"]'
    ).first();
    await expect(descField).toBeVisible({ timeout: 5000 });
    await descField.fill('Test catalog for download JSON test');

    // 11. Select this spec's own inject type from the combobox, not whatever happens
    // to render first. The option list is global across concurrently-running specs;
    // picking blindly binds this catalog to a sibling spec's inject type, and that
    // sibling's teardown CASCADE-DELETEs this catalog when it deletes its own
    // inject type.
    const injectTypeCombobox = page.getByRole('combobox', { name: /Inject Type/i }).first();
    await expect(injectTypeCombobox).toBeVisible({ timeout: 5000 });
    await injectTypeCombobox.click();
    const injectTypeOption = page
      .locator('mat-option, [role="option"]')
      .filter({ hasText: INJECT_TYPE_NAME });
    await expect(injectTypeOption).toBeVisible({ timeout: 5000 });
    await injectTypeOption.click();

    // 12. Save the catalog
    const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();

    // expect: The catalog appears in the list
    await expect(page.locator(`text=${CATALOG_NAME}`).first()).toBeVisible({ timeout: 10000 });

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
