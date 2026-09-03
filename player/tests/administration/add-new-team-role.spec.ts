// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Roles and Permissions', () => {
  test('Add New Team Role', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Roles > Team Roles tab
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Roles Roles' }).click();
    await page.getByRole('tab', { name: 'Team Roles' }).click();

    // expect: The Team Roles tab is displayed
    await expect(page.getByRole('tab', { name: 'Team Roles', selected: true })).toBeVisible();

    // 2. Click the add role button (+ icon in the Permissions header)
    const addRoleButton = page.getByRole('columnheader', { name: 'Permissions' }).locator('button').first();
    await expect(addRoleButton).toBeVisible();
    await addRoleButton.click();

    // expect: A dialog opens to create a new team role
    // 3. Enter a role name and save
    // expect: A new column is added to the team roles matrix
  });
});
