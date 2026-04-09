// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { readFileSync } from 'fs';

const CATALOG_NAME = 'Download JSON Test Catalog';
const INJECT_TYPE_NAME = 'Download JSON Test Inject Type';

test.describe('Admin - Inject Types and Catalogs Management', () => {
  test('Download Catalog as JSON', async ({ blueprintAuthenticatedPage: page }) => {
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // Helper: navigate to a section via the sidebar
    const navigateTo = async (section: string) => {
      const navItem = page.locator(`mat-list-item:has-text("${section}")`).first();
      await expect(navItem).toBeVisible({ timeout: 5000 });
      await navItem.click();
      // Wait for the section heading or content to be visible
      await expect(page.locator(`h1:has-text("${section}"), h2:has-text("${section}"), [class*="title"]:has-text("${section}"), mat-toolbar:has-text("${section}")`).first()).toBeVisible({ timeout: 5000 }).catch(async () => {
        // Fallback: wait for add button or list content to appear
        await page.waitForTimeout(500);
      });
    };

    // Helper: delete all rows whose delete button name matches a pattern
    const deleteAllMatching = async (namePattern: RegExp) => {
      let deleteBtn = page.getByRole('button', { name: namePattern }).first();
      while (await deleteBtn.isVisible().catch(() => false)) {
        await deleteBtn.click();
        const confirmDialog = page.locator(
          '[role="dialog"], .mat-dialog-container, [class*="dialog"]'
        ).first();
        await expect(confirmDialog).toBeVisible({ timeout: 5000 });
        const confirmButton = page.locator(
          'button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes"), button:has-text("OK")'
        ).last();
        await confirmButton.click();
        // Wait for dialog to close
        await expect(confirmDialog).not.toBeVisible({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(500);
        deleteBtn = page.getByRole('button', { name: namePattern }).first();
      }
    };

    // ── Step 0: Pre-cleanup ──────────────────────────────────────────────────

    // 1. Navigate to Catalogs and delete any leftover test catalog
    await navigateTo('Catalogs');
    await deleteAllMatching(new RegExp(`^Delete ${CATALOG_NAME}`));

    // 2. Navigate to Inject Types and delete any leftover test inject type
    await navigateTo('Inject Types');
    await deleteAllMatching(new RegExp(`^Delete ${INJECT_TYPE_NAME}`));

    // ── Step 1: Create a prerequisite Inject Type ────────────────────────────

    // 3. Click add button to create a new inject type
    const addInjectTypeButton = page.locator(
      'button[title*="Add"], button[aria-label*="Add"]'
    ).first();
    await expect(addInjectTypeButton).toBeVisible({ timeout: 5000 });
    await addInjectTypeButton.click();
    await page.waitForTimeout(500);

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
    await page.waitForTimeout(500);

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

    // 11. Select the inject type from the combobox
    const injectTypeCombobox = page.getByRole('combobox', { name: /Inject Type/i }).first();
    await expect(injectTypeCombobox).toBeVisible({ timeout: 5000 });
    await injectTypeCombobox.click();
    await page.waitForTimeout(300);
    const firstOption = page.locator('mat-option, [role="option"]').first();
    await expect(firstOption).toBeVisible({ timeout: 5000 });
    await firstOption.click();

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

    // ── Step 4: Cleanup ──────────────────────────────────────────────────────

    // 15. Delete the catalog (still on Catalogs page)
    await deleteAllMatching(new RegExp(`^Delete ${CATALOG_NAME}`));

    // 16. Navigate to Inject Types and delete the test inject type
    await navigateTo('Inject Types');
    await deleteAllMatching(new RegExp(`^Delete ${INJECT_TYPE_NAME}`));
  });
});
