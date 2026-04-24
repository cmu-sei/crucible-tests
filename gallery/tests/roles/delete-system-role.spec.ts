// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Role and Permission Management', () => {
  const testRoleName = `DeleteRole${Date.now()}`;

  test('Delete System Role', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // Navigate to Roles section
    await page.locator('mat-list-item').filter({ hasText: 'Roles' }).getByRole('button').click();
    await expect(page.getByRole('tab', { name: 'Roles', selected: true })).toBeVisible();

    // Setup: Create a custom role to delete
    const addRoleButton = page.getByRole('columnheader', { name: 'Permissions' }).getByRole('button').first();
    await addRoleButton.click();
    const createDialog = page.getByRole('dialog');
    if (await createDialog.isVisible().catch(() => false)) {
      await createDialog.getByRole('textbox').fill(testRoleName);
      await createDialog.getByRole('button', { name: /save|ok|confirm|add/i }).click();
    }
    await expect(page.getByRole('columnheader', { name: testRoleName })).toBeVisible();

    // 1. Click the 'Delete Role' button (trash icon) on the custom role column header
    const roleHeader = page.getByRole('columnheader', { name: testRoleName });
    await roleHeader.getByRole('button', { name: 'Delete Role' }).click();

    // expect: A confirmation dialog appears
    const confirmDialog = page.getByRole('dialog');
    if (await confirmDialog.isVisible().catch(() => false)) {
      // 2. Confirm deletion
      await confirmDialog.getByRole('button', { name: /yes|confirm|ok|delete/i }).click();
    }

    // expect: The role column is removed from the permission matrix
    await expect(page.getByRole('columnheader', { name: testRoleName })).not.toBeVisible();
  });
});
