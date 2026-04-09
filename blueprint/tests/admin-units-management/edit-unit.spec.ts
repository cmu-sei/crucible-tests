// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin - Units Management', () => {
  test('Edit Unit', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Navigate to Units list and click edit icon for a unit, modify details, and click 'Save'
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await page.waitForLoadState('networkidle');

    const unitsNav = page.locator(
      'mat-list-item:has-text("Units"), a:has-text("Units"), button:has-text("Units")'
    ).first();
    await expect(unitsNav).toBeVisible({ timeout: 5000 });
    await unitsNav.click();
    await page.waitForLoadState('networkidle');

    // Pre-cleanup: remove any pre-existing 'Edit Test Unit' from previous test runs
    const deleteAllEditTestUnits = async () => {
      let deleteBtn = page.getByRole('button', { name: 'Delete Edit Test Unit' }).first();
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
        deleteBtn = page.getByRole('button', { name: 'Delete Edit Test Unit' }).first();
      }
    };

    await deleteAllEditTestUnits();

    // Create a unit named "Edit Test Unit" so we always have something to edit
    const addButton = page.getByRole('button', { name: 'Add Unit' });
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await addButton.click();

    await page.waitForTimeout(500);
    const form = page.locator('[role="dialog"], [class*="dialog"], [class*="form"]').first();
    await expect(form).toBeVisible({ timeout: 5000 });

    const shortNameField = page.locator(
      'input[formControlName*="shortName"], input[placeholder*="Short Name"], input[name*="short"]'
    ).first();
    await expect(shortNameField).toBeVisible({ timeout: 5000 });
    await shortNameField.fill('ETU');

    const nameField = page.locator(
      'input[formControlName="name"], input[placeholder*="Name"]:not([placeholder*="Short"])'
    ).first();
    await expect(nameField).toBeVisible({ timeout: 5000 });
    await nameField.fill('Edit Test Unit');

    const saveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    ).first();
    await saveButton.click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify the unit was created
    const createdUnit = page.getByRole('cell', { name: 'Edit Test Unit', exact: true }).first();
    await expect(createdUnit).toBeVisible({ timeout: 5000 });

    // Click edit button for the created unit
    const editButton = page.getByRole('button', { name: /^Edit / }).first();
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();

    // expect: Edit form appears
    await page.waitForTimeout(500);
    const editForm = page.locator('[role="dialog"], [class*="dialog"], [class*="form"]').first();
    await expect(editForm).toBeVisible({ timeout: 5000 });

    // Modify the Name field
    const editNameField = page.locator(
      'input[formControlName="name"], input[placeholder*="Name"]:not([placeholder*="Short"])'
    ).first();
    await expect(editNameField).toBeVisible({ timeout: 5000 });
    const timestamp = Date.now();
    await editNameField.clear();
    await editNameField.fill(`Updated Unit ${timestamp}`);

    // Click 'Save'
    const editSaveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    ).first();
    await editSaveButton.click();

    // expect: Unit is updated successfully
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // expect: Changes are reflected in the table
    const updatedUnit = page.locator(`text=Updated Unit ${timestamp}`).first();
    await expect(updatedUnit).toBeVisible({ timeout: 5000 });

    // Cleanup: delete the updated unit to restore state
    const deleteButton = page.getByRole('button', { name: /^Delete / }).first();
    await expect(deleteButton).toBeVisible({ timeout: 5000 });
    await deleteButton.click();

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

    // expect: Updated unit no longer appears in the table
    await expect(page.locator(`text=Updated Unit ${timestamp}`).first()).not.toBeVisible({ timeout: 5000 });
  });
});
