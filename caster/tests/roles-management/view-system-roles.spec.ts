// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Roles and Permissions Management', () => {
  test('View System Roles and Permissions Matrix', async ({ casterAuthenticatedPage: page }) => {

    // 1. Navigate to Admin section and click on Roles in the sidebar
    await page.goto(Services.Caster.UI + '/admin?section=Roles');

    // expect: Roles page loads
    await expect(page).toHaveURL(/section=Roles/);

    // expect: Two tabs are visible: Roles and Project Roles
    await expect(page.getByRole('tab', { name: 'Roles', exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: 'Project Roles' })).toBeVisible();

    // expect: Roles tab is selected by default showing system roles
    await expect(page.getByRole('tab', { name: 'Roles', exact: true })).toHaveAttribute('aria-selected', 'true');

    // expect: Permissions matrix displays with roles as columns
    await expect(page.getByRole('columnheader', { name: 'Permissions' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Administrator' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Content Developer' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Observer' })).toBeVisible();

    // expect: All permissions are listed as rows
    const expectedPermissions = [
      'All', 'CreateProjects', 'ViewProjects', 'EditProjects', 'ManageProjects',
      'ImportProjects', 'LockFiles', 'ImportResources', 'ViewUsers', 'ManageUsers',
      'ViewWorkspaces', 'ManageWorkspaces', 'ViewVLANs', 'ManageVLANs',
      'ViewRoles', 'ManageRoles', 'ViewGroups', 'ManageGroups',
      'ViewHosts', 'ManageHosts', 'ViewModules', 'ManageModules'
    ];
    for (const perm of expectedPermissions) {
      await expect(page.getByRole('cell', { name: perm }).first()).toBeVisible();
    }
  });
});
