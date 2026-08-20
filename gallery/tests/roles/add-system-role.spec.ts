// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoGalleryAdmin, gotoAdminSection, apiCleanupSystemRoles } from '../../fixtures';

test.describe('Role and Permission Management', () => {
  // Unique per test so an `afterEach` purge can never touch another spec's (or
  // another worker's) role. `AddRoleTest` is this spec file's private prefix.
  let testRoleName: string;

  test.beforeEach(() => {
    testRoleName = `AddRoleTest${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  });

  // A custom role that survives the test leaks into the shared permission matrix
  // and pollutes every later run of system-roles-matrix, so purge via the API
  // even when the test body throws partway through.
  test.afterEach(async () => {
    await apiCleanupSystemRoles([testRoleName]);
  });

  test('Add Custom System Role', async ({ galleryAuthenticatedPage: page }) => {
    await gotoGalleryAdmin(page);

    // Navigate to Roles section
    await gotoAdminSection(page, 'Roles');
    await expect(page.getByRole('tab', { name: 'Roles', selected: true })).toBeVisible();

    // 1. Click the Add Role button (plus icon) in the Roles tab header
    const addRoleButton = page.getByRole('columnheader', { name: 'Permissions' }).getByRole('button').first();
    await addRoleButton.click();

    // expect: The "Create New Role?" name dialog opens
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // 2. Enter a new role name and confirm
    await dialog.getByLabel('Name').fill(testRoleName);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).not.toBeVisible();

    // expect: A new column appears in the permission matrix for the new role
    await expect(page.getByRole('columnheader', { name: testRoleName })).toBeVisible();

    // expect: The new (mutable) role exposes Rename/Delete affordances that the
    // built-in immutable roles do not.
    const roleHeader = page.getByRole('columnheader', { name: testRoleName });
    await expect(roleHeader.getByRole('button', { name: 'Rename Role' })).toBeVisible();
    await expect(roleHeader.getByRole('button', { name: 'Delete Role' })).toBeVisible();
  });
});
