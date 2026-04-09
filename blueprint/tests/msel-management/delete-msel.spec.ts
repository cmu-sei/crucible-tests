// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('MSEL Management', () => {
  test('Delete MSEL', async ({ blueprintAuthenticatedPage: page }) => {
    await page.goto(`${Services.Blueprint.UI}/build`);

    // 1. Navigate to MSELs list
    await expect(page).toHaveURL(/.*\/build.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // expect: MSELs list is visible
    const mselRows = page.getByRole('row').filter({ hasNotText: 'Name Description Template Status Created By Date Created Date Modified' });
    const initialCount = await mselRows.count();

    if (initialCount === 0) {
      test.skip();
      return;
    }

    // Find a non-template MSEL to delete (template MSELs have disabled delete buttons)
    // Get all delete buttons and find the first enabled one
    const deleteButtons = page.getByRole('button', { name: /Delete .+/ });
    const deleteButtonCount = await deleteButtons.count();

    let deleteButton = null;
    for (let i = 0; i < deleteButtonCount; i++) {
      const btn = deleteButtons.nth(i);
      const isEnabled = await btn.isEnabled().catch(() => false);
      if (isEnabled) {
        deleteButton = btn;
        break;
      }
    }

    if (!deleteButton) {
      console.log('No enabled delete buttons found - all MSELs may be templates');
      test.skip();
      return;
    }

    await expect(deleteButton).toBeVisible({ timeout: 5000 });

    // 2. Click the delete icon for a non-template MSEL
    await deleteButton.click();

    // expect: A confirmation dialog appears asking to confirm deletion
    await page.waitForTimeout(500);
    const confirmDialog = page.locator(
      '[role="dialog"], [class*="dialog"], [class*="modal"], .mat-dialog-container'
    ).first();
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    // 3. Click 'Cancel'
    const cancelButton = page.locator(
      'button:has-text("Cancel"), button:has-text("No")'
    ).first();
    await cancelButton.click();

    // expect: The dialog closes
    await page.waitForTimeout(500);
    await expect(confirmDialog).not.toBeVisible();

    // expect: The MSEL is not deleted
    const countAfterCancel = await mselRows.count();
    expect(countAfterCancel).toBe(initialCount);

    // Click the delete icon again
    await deleteButton.click();

    // expect: Confirmation dialog appears again
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    // Click 'Confirm' or 'Delete' button to confirm deletion
    const confirmButton = page.locator(
      'button:has-text("Delete"), button:has-text("Confirm"), button:has-text("Yes"), button:has-text("OK")'
    ).last();
    await confirmButton.click();

    // expect: The MSEL is deleted successfully
    await page.waitForLoadState('networkidle');

    // expect: The MSEL is removed from the list
    const countAfterDelete = await mselRows.count();
    expect(countAfterDelete).toBeLessThan(initialCount);

    // 4. Observe the delete button on a template MSEL
    // expect: The delete button is disabled for template MSELs
    // Find a row with the template checkbox checked
    const templateRows = page.locator(
      'table tbody tr:has(mat-checkbox input[type="checkbox"]:checked)'
    );
    const templateRowCount = await templateRows.count();

    if (templateRowCount > 0) {
      const templateDeleteButton = templateRows.first().locator(
        'button[title*="Delete"], button[aria-label*="Delete"], button:has(mat-icon:has-text("delete"))'
      ).first();
      const deleteDisabled = await templateDeleteButton.isDisabled().catch(() => true);
      // expect: Delete button is disabled for template MSELs
      expect(deleteDisabled).toBe(true);
    }
  });
});
