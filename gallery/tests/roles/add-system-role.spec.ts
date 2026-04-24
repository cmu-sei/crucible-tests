// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Role and Permission Management', () => {
  const testRoleName = `TestRole${Date.now()}`;

  test('Add Custom System Role', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // Navigate to Roles section
    await page.locator('mat-list-item').filter({ hasText: 'Roles' }).getByRole('button').click();
    await expect(page.getByRole('tab', { name: 'Roles', selected: true })).toBeVisible();

    // 1. Click the Add Role button (plus icon) in the Roles tab header
    const addRoleButton = page.getByRole('columnheader', { name: 'Permissions' }).getByRole('button').first();
    await addRoleButton.click();

    // 2. Enter a new role name and confirm
    // A dialog or input should appear
    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible().catch(() => false)) {
      await dialog.getByRole('textbox').fill(testRoleName);
      await dialog.getByRole('button', { name: /save|ok|confirm|add/i }).click();
    }

    // expect: A new column appears in the permission matrix for the new role
    await expect(page.getByRole('columnheader', { name: testRoleName })).toBeVisible();

    // Cleanup: Delete the custom role
    const roleHeader = page.getByRole('columnheader', { name: testRoleName });
    await roleHeader.getByRole('button', { name: 'Delete Role' }).click();
    const confirmDialog = page.getByRole('dialog');
    if (await confirmDialog.isVisible().catch(() => false)) {
      await confirmDialog.getByRole('button', { name: /yes|confirm|ok|delete/i }).click();
    }
    await expect(page.getByRole('columnheader', { name: testRoleName })).not.toBeVisible();
  });
});
