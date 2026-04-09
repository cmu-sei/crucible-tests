// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin - Units Management', () => {
  const unitName = `Test Unit - ${Date.now()}`;
  const unitShortName = 'TU';

  // Helper: navigate to the Units admin section (assumes already authenticated and on /admin)
  async function navigateToUnits(page: any) {
    const unitsNav = page.locator(
      'mat-list-item:has-text("Units"), a:has-text("Units"), button:has-text("Units")'
    ).first();
    await expect(unitsNav).toBeVisible({ timeout: 5000 });
    await unitsNav.click();
    await page.waitForLoadState('networkidle');
  }

  // Helper: create a unit via the UI, returns when unit row is visible in table
  async function createUnit(page: any, shortName: string, name: string) {
    const addButton = page.getByRole('button', { name: 'Add Unit' });
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await addButton.click();

    // expect: Unit creation form (dialog) appears
    const form = page.locator('[role="dialog"], [class*="dialog"], [class*="form"]').first();
    await expect(form).toBeVisible({ timeout: 5000 });

    // Fill Short Name
    const shortNameField = page.locator(
      'input[formControlName*="shortName"], input[placeholder*="Short Name"], input[name*="short"]'
    ).first();
    await expect(shortNameField).toBeVisible({ timeout: 5000 });
    await shortNameField.fill(shortName);

    // Fill Name
    const nameField = page.locator(
      'input[formControlName="name"], input[placeholder*="Name"]:not([placeholder*="Short"])'
    ).first();
    await expect(nameField).toBeVisible({ timeout: 5000 });
    await nameField.fill(name);

    // Submit
    const saveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    ).first();
    await saveButton.click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Verify the unit row is now visible
    const unitCell = page.getByRole('cell', { name: name, exact: true }).first();
    await expect(unitCell).toBeVisible({ timeout: 5000 });
  }

  // Helper: delete all rows with the given unit name via UI
  async function deleteUnitByName(page: any, name: string) {
    let deleteBtn = page.getByRole('button', { name: `Delete ${name}` }).first();
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
      deleteBtn = page.getByRole('button', { name: `Delete ${name}` }).first();
    }
  }

  test('View and Manage Unit Users', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Navigate to Units admin section
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await page.waitForLoadState('networkidle');
    await navigateToUnits(page);

    // Pre-cleanup: remove any leftover units from prior test runs with the same name prefix
    const staleDeleteBtn = page.getByRole('button', { name: /^Delete Test Unit - / }).first();
    while (await staleDeleteBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await staleDeleteBtn.click();
      const confirmDialog = page.locator('[role="dialog"], .mat-dialog-container, [class*="dialog"]').first();
      await expect(confirmDialog).toBeVisible({ timeout: 5000 });
      const confirmButton = page.locator(
        'button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes"), button:has-text("OK")'
      ).last();
      await confirmButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
    }

    // 2. Create a unit so the test always has data to work with
    await createUnit(page, unitShortName, unitName);

    try {
      // 3. Click on the unit row to expand it
      // The unit row that matches our created unit name
      const unitRow = page.locator('table tbody tr.element-row').filter({ hasText: unitName }).first();
      await expect(unitRow).toBeVisible({ timeout: 5000 });
      await unitRow.click();
      await page.waitForTimeout(500);

      // expect: Row expands — it gets the class 'element-row-expanded'
      await expect(unitRow).toHaveClass(/element-row-expanded/, { timeout: 3000 });

      // expect: Expanded detail row is visible, showing the app-admin-unit-users component
      const expandedDetail = page.locator('tr.detail-row app-admin-unit-users').first();
      await expect(expandedDetail).toBeVisible({ timeout: 5000 });

      // expect: "Unit Members" panel is visible within the expanded detail
      const unitMembersPanel = expandedDetail.locator('p:has-text("Unit Members")').first();
      await expect(unitMembersPanel).toBeVisible({ timeout: 5000 });

      // expect: "Users" panel (all users list for adding) is visible within the expanded detail
      const usersPanel = expandedDetail.locator('p:has-text("Users")').first();
      await expect(usersPanel).toBeVisible({ timeout: 5000 });

      // expect: Since we have admin manage permissions, add-user buttons are present and enabled
      const addUserButton = expandedDetail.locator('button[title^="Add "]').first();
      await expect(addUserButton).toBeVisible({ timeout: 5000 });
      await expect(addUserButton).toBeEnabled();

      // 4. Click on the same row again to collapse it
      await unitRow.click();
      await page.waitForTimeout(500);

      // expect: Row collapses — it gets the class 'element-row-not-expanded'
      await expect(unitRow).toHaveClass(/element-row-not-expanded/, { timeout: 3000 });

      // expect: Expanded detail is no longer visible
      await expect(expandedDetail).not.toBeVisible({ timeout: 3000 });
    } finally {
      // Cleanup: delete the created unit even if the test assertions fail
      await page.waitForLoadState('networkidle');
      await deleteUnitByName(page, unitName);

      // expect: Unit no longer appears in the table
      await expect(
        page.getByRole('cell', { name: unitName, exact: true }).first()
      ).not.toBeVisible({ timeout: 5000 });
    }
  });
});
