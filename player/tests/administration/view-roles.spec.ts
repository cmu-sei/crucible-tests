// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Roles and Permissions', () => {
  test('View Roles', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();

    // expect: The Administration page is displayed
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // 2. Click the 'Roles' button
    await page.getByRole('button', { name: 'Roles Roles' }).click();

    // expect: The Roles/Permissions section is displayed
    await expect(page).toHaveURL(/section=role-perm/);

    // expect: Two tabs are shown: 'Roles' and 'Team Roles'
    await expect(page.getByRole('tab', { name: 'Roles', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Team Roles' })).toBeVisible();

    // expect: The 'Roles' tab is active by default
    await expect(page.getByRole('tab', { name: 'Roles', exact: true, selected: true })).toBeVisible();

    // expect: A permissions matrix is displayed showing roles and permissions
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Permissions' })).toBeVisible();
  });
});
