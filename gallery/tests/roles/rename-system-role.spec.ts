// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Role and Permission Management', () => {
  const testRoleName = `RenameRole${Date.now()}`;
  const renamedRoleName = `Renamed${Date.now()}`;

  test('Rename System Role', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // Navigate to Roles section
    await page.locator('mat-list-item').filter({ hasText: 'Roles' }).getByRole('button').click();
    await expect(page.getByRole('tab', { name: 'Roles', selected: true })).toBeVisible();

    // Setup: Create a custom role to rename
    const addRoleButton = page.getByRole('columnheader', { name: 'Permissions' }).getByRole('button').first();
    await addRoleButton.click();
    const createDialog = page.getByRole('dialog');
    if (await createDialog.isVisible().catch(() => false)) {
      await createDialog.getByRole('textbox').fill(testRoleName);
      await createDialog.getByRole('button', { name: /save|ok|confirm|add/i }).click();
    }
    await expect(page.getByRole('columnheader', { name: testRoleName })).toBeVisible();

    // 1. Click the 'Rename Role' button (pencil icon) on the custom role column header
    const roleHeader = page.getByRole('columnheader', { name: testRoleName });
    await roleHeader.getByRole('button', { name: 'Rename Role' }).click();

    // expect: A rename dialog or inline edit appears
    const renameDialog = page.getByRole('dialog');
    if (await renameDialog.isVisible().catch(() => false)) {
      // 2. Enter a new name and confirm
      await renameDialog.getByRole('textbox').clear();
      await renameDialog.getByRole('textbox').fill(renamedRoleName);
      await renameDialog.getByRole('button', { name: /save|ok|confirm/i }).click();
    }

    // expect: The role column header updates to show the new name
    await expect(page.getByRole('columnheader', { name: renamedRoleName })).toBeVisible();

    // Cleanup: Delete the renamed role
    const renamedHeader = page.getByRole('columnheader', { name: renamedRoleName });
    await renamedHeader.getByRole('button', { name: 'Delete Role' }).click();
    const confirmDialog = page.getByRole('dialog');
    if (await confirmDialog.isVisible().catch(() => false)) {
      await confirmDialog.getByRole('button', { name: /yes|confirm|ok|delete/i }).click();
    }
  });
});
