// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Users and Permissions Management', () => {
  test('View Permissions List', async ({ casterAuthenticatedPage: page }) => {

    // 1. Navigate to admin section
    await page.goto(Services.Caster.UI + '/admin');

    // expect: Admin page loads
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 10000 });

    // 2. Click on 'Roles' in the sidebar (permissions are managed via the Roles matrix)
    await page.locator('mat-list-item').filter({ hasText: 'Roles' }).click();

    // expect: Permissions management page is displayed via the Roles matrix
    await expect(page).toHaveURL(/section=Roles/);

    // expect: List of all permissions is shown as rows
    await expect(page.getByRole('columnheader', { name: 'Permissions' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'CreateProjects' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ViewProjects' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'EditProjects' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ManageProjects' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ViewUsers' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ManageUsers' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ViewWorkspaces' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ViewVLANs' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ViewRoles' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ViewGroups' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ViewModules' })).toBeVisible();
  });
});
