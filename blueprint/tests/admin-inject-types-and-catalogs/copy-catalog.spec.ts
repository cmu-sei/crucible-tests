// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

const CATALOG_NAME = 'Copy Test Catalog';
const INJECT_TYPE_NAME = 'Copy Test Inject Type';

test.describe('Admin - Inject Types and Catalogs Management', () => {
  test('Copy Catalog', async ({ blueprintAuthenticatedPage: page }) => {
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await page.waitForLoadState('networkidle');

    // Helper: navigate to a section via the sidebar mat-list-item
    const navigateTo = async (section: string) => {
      const navItem = page.locator(`mat-list-item:has-text("${section}")`).first();
      await expect(navItem).toBeVisible({ timeout: 5000 });
      await navItem.click();
      await page.waitForLoadState('networkidle');
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
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        deleteBtn = page.getByRole('button', { name: namePattern }).first();
      }
    };

    // ── Step 0: Pre-cleanup ──────────────────────────────────────────────────

    // Clean up leftover test catalogs from previous runs
    await navigateTo('Catalogs');
    await deleteAllMatching(new RegExp(`^Delete ${CATALOG_NAME}`));

    // Clean up leftover test inject types from previous runs
    await navigateTo('Inject Types');
    await deleteAllMatching(new RegExp(`^Delete ${INJECT_TYPE_NAME}`));

    // ── Step 1: Create a prerequisite Inject Type ────────────────────────────

    const addInjectTypeButton = page.locator(
      'button[title*="Add"], button[aria-label*="Add"]'
    ).first();
    await expect(addInjectTypeButton).toBeVisible({ timeout: 5000 });
    await addInjectTypeButton.click();
    await page.waitForTimeout(500);

    const injectTypeNameField = page.locator(
      'input[formControlName="name"], input[placeholder*="Name"]'
    ).first();
    await expect(injectTypeNameField).toBeVisible({ timeout: 5000 });
    await injectTypeNameField.fill(INJECT_TYPE_NAME);

    const injectTypeDescField = page.locator(
      'textarea[formControlName="description"], textarea[placeholder*="Description"], input[placeholder*="Description"]'
    ).first();
    const injectTypeDescVisible = await injectTypeDescField.isVisible({ timeout: 2000 }).catch(() => false);
    if (injectTypeDescVisible) {
      await injectTypeDescField.fill('Test inject type for copy catalog test');
    }

    const injectTypeSaveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    ).first();
    await expect(injectTypeSaveButton).toBeEnabled({ timeout: 5000 });
    await injectTypeSaveButton.click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    const createdInjectType = page.locator(`text=${INJECT_TYPE_NAME}`).first();
    await expect(createdInjectType).toBeVisible({ timeout: 5000 });

    // ── Step 2: Navigate to Catalogs and create "Copy Test Catalog" ──────────

    await navigateTo('Catalogs');

    const addCatalogButton = page.locator(
      'button[title*="Add new Catalog"], button[title*="Add Catalog"]'
    ).first();
    await expect(addCatalogButton).toBeVisible({ timeout: 5000 });
    await addCatalogButton.click();
    await page.waitForTimeout(500);

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

    // Select Inject Type (required) - click the combobox and pick the first option
    const injectTypeCombobox = page.getByRole('combobox', { name: /Inject Type/i }).first();
    await expect(injectTypeCombobox).toBeVisible({ timeout: 5000 });
    await injectTypeCombobox.click();
    await page.waitForTimeout(300);
    const firstInjectOption = page.locator('mat-option, [role="option"]').first();
    await expect(firstInjectOption).toBeVisible({ timeout: 5000 });
    await firstInjectOption.click();

    // Save the catalog
    const catalogSaveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
    await expect(catalogSaveButton).toBeEnabled({ timeout: 5000 });
    await catalogSaveButton.click();

    // Verify the catalog was created
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    const createdCatalog = page.locator(`text=${CATALOG_NAME}`).first();
    await expect(createdCatalog).toBeVisible({ timeout: 5000 });

    // Record the count after creation
    const catalogRows = page.locator('table tbody tr');
    const initialCount = await catalogRows.count();

    // ── Step 3: Copy the catalog ─────────────────────────────────────────────

    const copyButton = page.getByRole('button', { name: new RegExp(`^Copy ${CATALOG_NAME}`) }).first();
    await expect(copyButton).toBeVisible({ timeout: 5000 });
    await copyButton.click();

    // If a confirmation dialog appears, confirm it
    const confirmDialog = page.locator('[role="dialog"], .mat-dialog-container, [class*="dialog"]').first();
    const dialogVisible = await confirmDialog.isVisible({ timeout: 2000 }).catch(() => false);
    if (dialogVisible) {
      const confirmButton = page.locator(
        'button:has-text("Confirm"), button:has-text("Copy"), button:has-text("Yes"), button:has-text("OK")'
      ).last();
      await confirmButton.click();
    }

    // ── Step 4: Verify count increased by 1 ─────────────────────────────────

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    const newCount = await catalogRows.count();
    expect(newCount).toBeGreaterThan(initialCount);

    // ── Step 5: Cleanup ──────────────────────────────────────────────────────

    // Delete all "Copy Test Catalog" rows (original + copy)
    await deleteAllMatching(new RegExp(`^Delete ${CATALOG_NAME}`));

    // Delete the test inject type
    await navigateTo('Inject Types');
    await deleteAllMatching(new RegExp(`^Delete ${INJECT_TYPE_NAME}`));
  });
});
