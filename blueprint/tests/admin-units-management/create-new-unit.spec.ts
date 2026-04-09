// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin - Units Management', () => {
  test('Create New Unit', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Navigate to Units admin section and click 'Add Unit' button, enter 'CU' in Short Name and 'Cyber Unit' in Name, then click 'Save'
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await page.waitForLoadState('networkidle');

    const unitsNav = page.locator(
      'mat-list-item:has-text("Units"), a:has-text("Units"), button:has-text("Units")'
    ).first();
    await expect(unitsNav).toBeVisible({ timeout: 5000 });
    await unitsNav.click();
    await page.waitForLoadState('networkidle');

    // Helper to delete all instances of 'Cyber Unit' from the table
    const deleteAllCyberUnits = async () => {
      let deleteBtn = page.getByRole('button', { name: 'Delete Cyber Unit' }).first();
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
        deleteBtn = page.getByRole('button', { name: 'Delete Cyber Unit' }).first();
      }
    };

    // Pre-cleanup: remove any pre-existing 'Cyber Unit' from previous test runs
    await deleteAllCyberUnits();

    try {
      // 2. Click 'Add Unit' button
      const addButton = page.getByRole('button', { name: 'Add Unit' });
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      // expect: Unit creation form appears
      await page.waitForTimeout(500);
      const form = page.locator('[role="dialog"], [class*="dialog"], [class*="form"]').first();
      await expect(form).toBeVisible({ timeout: 5000 });

      // 3. Enter 'CU' in Short Name
      const shortNameField = page.locator(
        'input[formControlName*="shortName"], input[placeholder*="Short Name"], input[name*="short"]'
      ).first();
      await expect(shortNameField).toBeVisible({ timeout: 5000 });
      await shortNameField.fill('CU');

      // 4. Enter 'Cyber Unit' in Name
      const nameField = page.locator(
        'input[formControlName="name"], input[placeholder*="Name"]:not([placeholder*="Short"])'
      ).first();
      await expect(nameField).toBeVisible({ timeout: 5000 });
      await nameField.fill('Cyber Unit');

      // 5. Click 'Save'
      const saveButton = page.locator(
        'button:has-text("Save"), button[type="submit"]'
      ).first();
      await saveButton.click();

      // expect: Unit is created successfully
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // expect: New unit appears in the units table
      const newUnit = page.getByRole('cell', { name: 'Cyber Unit', exact: true }).first();
      await expect(newUnit).toBeVisible({ timeout: 5000 });

      // 6. Expand the 'Cyber Unit' row to reveal the unit users panel
      // Click the row (not the action buttons) to expand it
      const cyberUnitRow = page.locator('tr.element-row').filter({ hasText: 'Cyber Unit' }).first();
      await expect(cyberUnitRow).toBeVisible({ timeout: 5000 });
      await cyberUnitRow.click();
      await page.waitForTimeout(500);

      // expect: The expanded user panel is visible with a 'Users' section
      const usersPanel = page.locator('app-admin-unit-users').first();
      await expect(usersPanel).toBeVisible({ timeout: 5000 });

      // 7. Add a user ('admin') to the unit using the 'Add' button in the Users table
      // The button title is "Add <username>" in the all-users table
      const addUserButton = usersPanel.locator(
        'button[title*="Add "], button[aria-label*="Add "]'
      ).first();
      await expect(addUserButton).toBeVisible({ timeout: 5000 });

      // Capture the user name from the button title for assertion
      const addUserTitle = await addUserButton.getAttribute('title');
      const addedUserName = addUserTitle?.replace(/^Add\s+/, '') ?? 'admin';

      await addUserButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      // 8. Assert the user appears in the Unit Members table
      // expect: The added user appears in the 'Unit Members' section (scoped to .unit-list-container)
      const unitMembersSection = usersPanel.locator('.unit-list-container').first();
      await expect(unitMembersSection).toBeVisible({ timeout: 5000 });
      const memberEntry = unitMembersSection.locator(
        `mat-cell:has-text("${addedUserName}"), td:has-text("${addedUserName}")`
      ).first();
      await expect(memberEntry).toBeVisible({ timeout: 5000 });
    } finally {
      // Cleanup: delete the created 'Cyber Unit' to restore state
      await page.waitForLoadState('networkidle');
      await deleteAllCyberUnits();

      // expect: Unit no longer appears in the table
      await expect(page.getByRole('cell', { name: 'Cyber Unit', exact: true }).first()).not.toBeVisible({ timeout: 5000 });
    }
  });
});
