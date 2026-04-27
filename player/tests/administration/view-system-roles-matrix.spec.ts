// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Roles and Permissions', () => {
  test('View System Roles Permissions Matrix', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Roles
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Roles Roles' }).click();

    // expect: The Roles tab is active
    await expect(page.getByRole('tab', { name: 'Roles', selected: true })).toBeVisible();

    // 2. Observe the permissions matrix
    // expect: Columns show 'Administrator' and 'Content Developer' roles
    await expect(page.getByRole('columnheader', { name: 'Administrator' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Content Developer' })).toBeVisible();

    // expect: Rows show permissions
    await expect(page.getByRole('cell', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'CreateViews' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'EditViews' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ManageApplications' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ManageRoles' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ManageUsers' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ManageViews' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ViewApplications' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ViewRoles' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ViewUsers' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ViewViews' })).toBeVisible();

    // expect: Administrator role has 'All' permission checked and disabled
    const allRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'All', exact: true }) });
    const adminCell = allRow.getByRole('cell').nth(1);
    await expect(adminCell.getByRole('checkbox')).toBeChecked();
    await expect(adminCell.getByRole('checkbox')).toBeDisabled();
  });
});
