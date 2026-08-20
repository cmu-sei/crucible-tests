// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoGalleryAdmin, gotoAdminSection, apiCleanupSystemRoles } from '../../fixtures';

test.describe('Role and Permission Management', () => {
  // Unique per test so the `afterEach` purge can never touch another spec's (or
  // another worker's) role. `RenameRoleTest`/`RenamedRoleTest` are this spec
  // file's private prefixes.
  let testRoleName: string;
  let renamedRoleName: string;

  test.beforeEach(() => {
    const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    testRoleName = `RenameRoleTest${stamp}`;
    renamedRoleName = `RenamedRoleTest${stamp}`;
  });

  // Purge BOTH names: depending on where the test failed the role may still be
  // under its original name or already renamed. A leftover custom role pollutes
  // the shared permission matrix for every later run of system-roles-matrix.
  test.afterEach(async () => {
    await apiCleanupSystemRoles([testRoleName, renamedRoleName]);
  });

  test('Rename System Role', async ({ galleryAuthenticatedPage: page }) => {
    await gotoGalleryAdmin(page);

    // Navigate to Roles section
    await gotoAdminSection(page, 'Roles');
    await expect(page.getByRole('tab', { name: 'Roles', selected: true })).toBeVisible();

    // Setup: Create a custom role to rename
    const addRoleButton = page.getByRole('columnheader', { name: 'Permissions' }).getByRole('button').first();
    await addRoleButton.click();
    const createDialog = page.getByRole('dialog');
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel('Name').fill(testRoleName);
    await createDialog.getByRole('button', { name: 'Save' }).click();
    await expect(createDialog).not.toBeVisible();
    await expect(page.getByRole('columnheader', { name: testRoleName })).toBeVisible();

    // 1. Click the 'Rename Role' button (pencil icon) on the custom role column header
    const roleHeader = page.getByRole('columnheader', { name: testRoleName });
    await roleHeader.getByRole('button', { name: 'Rename Role' }).click();

    // expect: A rename dialog appears pre-filled with the current role name
    const renameDialog = page.getByRole('dialog');
    await expect(renameDialog).toBeVisible();
    await expect(renameDialog.getByLabel('Name')).toHaveValue(testRoleName);

    // 2. Enter a new name and confirm
    await renameDialog.getByLabel('Name').fill(renamedRoleName);
    await renameDialog.getByRole('button', { name: 'Save' }).click();
    await expect(renameDialog).not.toBeVisible();

    // expect: The role column header updates to show the new name
    await expect(page.getByRole('columnheader', { name: renamedRoleName })).toBeVisible();

    // expect: The old name no longer appears as a column
    await expect(page.getByRole('columnheader', { name: testRoleName })).toHaveCount(0);
  });
});
