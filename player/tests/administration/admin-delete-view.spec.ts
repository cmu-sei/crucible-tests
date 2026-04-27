// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Views', () => {
  test('Delete View', async ({ playerAuthenticatedPage: page }) => {
    const viewName = `Delete Test View ${Date.now()}`;

    // Setup: Create a temporary view for deletion
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // Create a test view first
    const createButton = page.locator('button:has(mat-icon.mdi-plus)');
    await createButton.click();
    const nameField = page.getByRole('textbox', { name: 'Name (required)' });
    await expect(nameField).toBeVisible({ timeout: 5000 });
    await nameField.fill(viewName);
    const descField = page.getByRole('textbox', { name: 'Description (required)' });
    await descField.fill('View to be deleted');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('button', { name: viewName, exact: true })).toBeVisible();

    // 1. Navigate to admin views section
    // expect: Views list displays
    await expect(page.getByRole('heading', { name: 'Views' })).toBeVisible();

    // 2. Click on the test view to open its edit form, then click Delete
    await page.getByRole('button', { name: viewName, exact: true }).click();
    await expect(page.getByRole('heading', { name: /Edit View:/ })).toBeVisible();

    await page.getByRole('button', { name: 'Delete View' }).click();

    // expect: Confirmation dialog appears
    // expect: Dialog warns about view deletion
    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();

    // 3. Click 'NO' in confirmation dialog to cancel
    await confirmDialog.getByRole('button', { name: 'NO' }).click();

    // expect: Dialog closes
    // expect: View is not deleted
    await expect(page.getByRole('button', { name: 'Delete View' })).toBeVisible();

    // 4. Click delete button again
    await page.getByRole('button', { name: 'Delete View' }).click();

    // expect: Confirmation dialog appears
    await expect(confirmDialog).toBeVisible();

    // 5. Click 'YES' in dialog to confirm deletion
    await confirmDialog.getByRole('button', { name: 'YES' }).click();

    // expect: View is deleted successfully
    // expect: View is removed from list
    await expect(page.getByRole('heading', { name: 'Views' })).toBeVisible();
    await expect(page.getByRole('button', { name: viewName, exact: true })).not.toBeVisible();
  });
});
