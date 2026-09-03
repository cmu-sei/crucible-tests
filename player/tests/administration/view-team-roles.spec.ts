// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Roles and Permissions', () => {
  test('View Team Roles', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Roles
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Roles Roles' }).click();

    // expect: The Roles section is displayed
    await expect(page.getByRole('tab', { name: 'Roles', exact: true })).toBeVisible();

    // 2. Click the 'Team Roles' tab
    await page.getByRole('tab', { name: 'Team Roles' }).click();

    // expect: The Team Roles tab becomes active
    await expect(page.getByRole('tab', { name: 'Team Roles', selected: true })).toBeVisible();

    // expect: A permissions matrix is displayed showing team-specific roles
    await expect(page.getByRole('table')).toBeVisible();

    // expect: Columns show 'View Admin', 'Observer', and 'View Member' roles
    await expect(page.getByRole('columnheader', { name: 'View Admin' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Observer' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'View Member' })).toBeVisible();

    // expect: Rows show team permissions
    await expect(page.getByRole('cell', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'EditTeam' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'EditView' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ManageTeam' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ManageView' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ViewTeam' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ViewView' })).toBeVisible();
  });
});
