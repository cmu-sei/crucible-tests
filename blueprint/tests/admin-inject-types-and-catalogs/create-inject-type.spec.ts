// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

const INJECT_TYPE_NAME = 'Create Inject Type Test';
const DATA_FIELD_NAME = 'Create Inject Type Test Data Field';

test.describe('Admin - Inject Types and Catalogs Management', () => {
  test('Create Inject Type', async ({ blueprintAuthenticatedPage: page }) => {
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await expect(page.locator('mat-list-item').first()).toBeVisible({ timeout: 10000 });

    // Helper: navigate to a section via the sidebar mat-list-item
    const navigateTo = async (section: string) => {
      const navItem = page.locator(`mat-list-item:has-text("${section}")`).first();
      await expect(navItem).toBeVisible({ timeout: 5000 });
      await navItem.click();
      await expect(page.locator('mat-toolbar, [class*="topbar"], table').first()).toBeVisible({ timeout: 5000 });
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
        await page.waitForTimeout(500);
        deleteBtn = page.getByRole('button', { name: namePattern }).first();
      }
    };

    // ── Step 0: Pre-cleanup ──────────────────────────────────────────────────

    await navigateTo('Inject Types');
    await deleteAllMatching(new RegExp(`^Delete ${INJECT_TYPE_NAME}`));

    // ── Step 1: Create the Inject Type ───────────────────────────────────────

    const addButton = page.locator(
      'button[title*="Add"], button[aria-label*="Add"]'
    ).first();
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await addButton.click();
    await page.waitForTimeout(500);

    // Fill in name
    const nameField = page.locator(
      'input[formControlName="name"], input[placeholder*="Name"]'
    ).first();
    await expect(nameField).toBeVisible({ timeout: 5000 });
    await nameField.fill(INJECT_TYPE_NAME);

    // Fill in description if visible
    const descField = page.locator(
      'textarea[formControlName="description"], textarea[placeholder*="Description"], input[placeholder*="Description"]'
    ).first();
    const descVisible = await descField.isVisible({ timeout: 2000 }).catch(() => false);
    if (descVisible) {
      await descField.fill('Test inject type description');
    }

    // Click 'Save'
    const saveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    ).first();
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();

    // ── Step 2: Verify ───────────────────────────────────────────────────────

    await expect(page.locator(`text=${INJECT_TYPE_NAME}`).first()).toBeVisible({ timeout: 5000 });

    // ── Step 3: Expand the inject type row ───────────────────────────────────

    // Click the inject type row to reveal detail panels
    const injectTypeRow = page.locator('mat-row.element-row').filter({ hasText: INJECT_TYPE_NAME });
    await expect(injectTypeRow).toBeVisible({ timeout: 5000 });
    await injectTypeRow.click();

    // Wait for the detail row to appear with the DataFields expansion panel header
    const dataFieldsHeader = page.locator('mat-expansion-panel-header').filter({ hasText: 'DataFields' });
    await expect(dataFieldsHeader).toBeVisible({ timeout: 5000 });

    // ── Step 4: Expand the "DataFields" section ──────────────────────────────

    await dataFieldsHeader.click();

    // Wait for the "Add data Field" button to become visible (confirms the panel is fully expanded)
    const addDataFieldButton = page.getByRole('button', { name: 'Add data Field' });
    await expect(addDataFieldButton).toBeVisible({ timeout: 5000 });

    // ── Step 5: Add a data field ─────────────────────────────────────────────

    // Click the "Add data Field" button inside the DataFields panel
    await addDataFieldButton.click();

    // Click "New Data Field" from the dropdown menu
    const newDataFieldMenuItem = page.locator('[role="menuitem"]').filter({ hasText: 'New Data Field' });
    await expect(newDataFieldMenuItem).toBeVisible({ timeout: 5000 });
    await newDataFieldMenuItem.click();

    // Wait for the "Add a Data Field" dialog to appear
    const addDataFieldDialog = page.locator('[role="dialog"]').filter({ hasText: 'Add a Data Field' });
    await expect(addDataFieldDialog).toBeVisible({ timeout: 5000 });

    // Fill in the Name field (required) — second text input in the dialog (first is Display Order)
    const dataFieldNameInput = addDataFieldDialog.getByLabel('Name');
    await expect(dataFieldNameInput).toBeVisible({ timeout: 5000 });
    await dataFieldNameInput.fill(DATA_FIELD_NAME);

    // Click Save
    const dataFieldSaveButton = addDataFieldDialog.locator('button:has-text("Save")');
    await expect(dataFieldSaveButton).toBeEnabled({ timeout: 5000 });
    await dataFieldSaveButton.click();

    // ── Step 6: Verify the data field appears ────────────────────────────────

    await expect(page.locator(`text=${DATA_FIELD_NAME}`).first()).toBeVisible({ timeout: 5000 });

    // ── Step 7: Cleanup ──────────────────────────────────────────────────────

    await deleteAllMatching(new RegExp(`^Delete ${INJECT_TYPE_NAME}`));
  });
});
