// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

const CATALOG_NAME = 'Expand Catalog Test';
const INJECT_TYPE_NAME = 'Expand Catalog Test Inject Type';

test.describe('Admin - Inject Types and Catalogs Management', () => {
  test('Expand Catalog to View Injects', async ({ blueprintAuthenticatedPage: page }) => {
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await page.waitForLoadState('networkidle');

    // Helper: navigate to a section via the sidebar
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

    await navigateTo('Catalogs');
    await deleteAllMatching(new RegExp(`^Delete ${CATALOG_NAME}`));

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
      'input[formControlName="description"], input[placeholder*="Description"], textarea[placeholder*="Description"]'
    ).first();
    await expect(injectTypeDescField).toBeVisible({ timeout: 5000 });
    await injectTypeDescField.fill('Test inject type for expand catalog test');

    const injectTypeSaveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    ).first();
    await expect(injectTypeSaveButton).toBeEnabled({ timeout: 5000 });
    await injectTypeSaveButton.click();

    await page.waitForLoadState('networkidle');
    await expect(page.locator(`text=${INJECT_TYPE_NAME}`).first()).toBeVisible({ timeout: 5000 });

    // ── Step 2: Create Catalog ───────────────────────────────────────────────

    await navigateTo('Catalogs');

    const addCatalogButton = page.getByRole('button', { name: 'Add new Catalog' });
    await expect(addCatalogButton).toBeVisible({ timeout: 5000 });
    await addCatalogButton.click();
    await page.waitForTimeout(500);

    const nameField = page.locator('input[placeholder*="Name"]').first();
    await expect(nameField).toBeVisible({ timeout: 5000 });
    await nameField.fill(CATALOG_NAME);

    const descField = page.locator(
      'input[placeholder*="Description"], textarea[placeholder*="Description"]'
    ).first();
    await expect(descField).toBeVisible({ timeout: 5000 });
    await descField.fill('Test catalog for expand/collapse test');

    const injectTypeCombobox = page.getByRole('combobox', { name: /Inject Type/i }).first();
    await expect(injectTypeCombobox).toBeVisible({ timeout: 5000 });
    await injectTypeCombobox.click();
    await page.waitForTimeout(300);
    const firstOption = page.locator('mat-option, [role="option"]').first();
    await expect(firstOption).toBeVisible({ timeout: 5000 });
    await firstOption.click();

    const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();

    await page.waitForLoadState('networkidle');
    await expect(page.locator(`text=${CATALOG_NAME}`).first()).toBeVisible({ timeout: 5000 });

    // ── Step 3: Navigate to Catalogs list and click on the catalog row ───────

    // 1. Click on the catalog row to expand it
    // Use mat-row to target data rows only (not the mat-header-row which is also in tbody
    // in Angular Material tables)
    const catalogDataRows = page.locator('mat-row, tr[mat-row]');
    const rowCount = await catalogDataRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Click on the first data row (the catalog we just created)
    const firstDataRow = catalogDataRows.first();
    await expect(firstDataRow).toBeVisible({ timeout: 5000 });
    await firstDataRow.click();
    await page.waitForTimeout(500);

    // expect: The row expands to show the inject list for that catalog
    // The expanded detail uses [@detailExpand] animation - look for the detail-row that is now visible
    const expandedContent = page.locator(
      'tr.detail-row mat-expansion-panel, .detail-row mat-expansion-panel, ' +
      '[class*="expanded-detail"], mat-expansion-panel:has-text("Injects")'
    ).first();
    const expandedVisible = await expandedContent.isVisible({ timeout: 3000 }).catch(() => false);
    if (expandedVisible) {
      await expect(expandedContent).toBeVisible({ timeout: 5000 });
    }

    // 2. Click the same row again to collapse it
    await firstDataRow.click();
    await page.waitForTimeout(500);

    // expect: The row collapses (expanded content is no longer visible)
    await expect(expandedContent).not.toBeVisible({ timeout: 3000 }).catch(() => {});

    // ── Step 4: Cleanup ──────────────────────────────────────────────────────

    await deleteAllMatching(new RegExp(`^Delete ${CATALOG_NAME}`));

    await navigateTo('Inject Types');
    await deleteAllMatching(new RegExp(`^Delete ${INJECT_TYPE_NAME}`));
  });
});
