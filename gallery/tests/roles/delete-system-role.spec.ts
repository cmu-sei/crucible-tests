// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoGalleryAdmin, gotoAdminSection, apiCleanupSystemRoles } from '../../fixtures';

test.describe('Role and Permission Management', () => {
  // Unique per test so the `afterEach` purge can never touch another spec's (or
  // another worker's) role. `DeleteRoleTest` is this spec file's private prefix.
  let testRoleName: string;

  test.beforeEach(() => {
    testRoleName = `DeleteRoleTest${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  });

  // The test deletes the role itself; this is the safety net for a mid-test
  // failure between create and delete, which would otherwise leave a custom
  // role in the shared permission matrix forever.
  test.afterEach(async () => {
    await apiCleanupSystemRoles([testRoleName]);
  });

  test('Delete System Role', async ({ galleryAuthenticatedPage: page }) => {
    await gotoGalleryAdmin(page);

    // Navigate to Roles section
    await gotoAdminSection(page, 'Roles');
    await expect(page.getByRole('tab', { name: 'Roles', selected: true })).toBeVisible();

    // Setup: Create a custom role to delete
    const addRoleButton = page.getByRole('columnheader', { name: 'Permissions' }).getByRole('button').first();
    await addRoleButton.click();
    const createDialog = page.getByRole('dialog');
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel('Name').fill(testRoleName);
    await createDialog.getByRole('button', { name: 'Save' }).click();
    await expect(createDialog).not.toBeVisible();
    await expect(page.getByRole('columnheader', { name: testRoleName })).toBeVisible();

    // 1. Click the 'Delete Role' button (trash icon) on the custom role column header
    const roleHeader = page.getByRole('columnheader', { name: testRoleName });
    await roleHeader.getByRole('button', { name: 'Delete Role' }).click();

    // expect: A confirmation dialog appears naming the role
    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText(testRoleName);

    // 2. Cancel first — the role must survive a declined confirmation
    await confirmDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirmDialog).not.toBeVisible();
    await expect(page.getByRole('columnheader', { name: testRoleName })).toBeVisible();

    // 3. Delete again and confirm
    await roleHeader.getByRole('button', { name: 'Delete Role' }).click();
    const confirmDialog2 = page.getByRole('dialog');
    await expect(confirmDialog2).toBeVisible();
    await confirmDialog2.getByRole('button', { name: 'Delete' }).click();
    await expect(confirmDialog2).not.toBeVisible();

    // expect: The role column is removed from the permission matrix
    await expect(page.getByRole('columnheader', { name: testRoleName })).toHaveCount(0);
  });
});
