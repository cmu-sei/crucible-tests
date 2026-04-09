// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin - Units Management', () => {
  test('Delete Unit', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Navigate to Units list, create a unit, click delete icon for it, then confirm
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await page.waitForLoadState('networkidle');

    const unitsNav = page.locator(
      'mat-list-item:has-text("Units"), a:has-text("Units"), button:has-text("Units")'
    ).first();
    await expect(unitsNav).toBeVisible({ timeout: 5000 });
    await unitsNav.click();
    await page.waitForLoadState('networkidle');

    // Pre-cleanup: remove any pre-existing 'Delete Test Unit' from previous test runs
    const deleteAllTestUnits = async () => {
      let deleteBtn = page.getByRole('button', { name: 'Delete Delete Test Unit' }).first();
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
        deleteBtn = page.getByRole('button', { name: 'Delete Delete Test Unit' }).first();
      }
    };

    await deleteAllTestUnits();

    // Create a unit named "Delete Test Unit" so we always have something to delete
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
    await shortNameField.fill('DTU');

    const nameField = page.locator(
      'input[formControlName="name"], input[placeholder*="Name"]:not([placeholder*="Short"])'
    ).first();
    await expect(nameField).toBeVisible({ timeout: 5000 });
    await nameField.fill('Delete Test Unit');

    const saveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    ).first();
    await saveButton.click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify the unit was created
    const newUnit = page.getByRole('cell', { name: 'Delete Test Unit', exact: true }).first();
    await expect(newUnit).toBeVisible({ timeout: 5000 });

    // Record the current unit count
    const unitRows = page.locator('table tbody tr');
    const initialCount = await unitRows.count();

    // Click delete button for the created unit
    const deleteButton = page.getByRole('button', { name: /^Delete / }).first();
    await expect(deleteButton).toBeVisible({ timeout: 5000 });
    await deleteButton.click();

    // expect: Confirmation dialog appears
    const confirmDialog = page.locator(
      '[role="dialog"], .mat-dialog-container, [class*="dialog"]'
    ).first();
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    // Confirm the deletion
    const confirmButton = page.locator(
      'button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes"), button:has-text("OK")'
    ).last();
    await confirmButton.click();

    // expect: Unit is deleted successfully and removed from table
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    const newCount = await unitRows.count();
    expect(newCount).toBeLessThan(initialCount);
  });
});
