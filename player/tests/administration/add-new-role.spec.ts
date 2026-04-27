// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Roles and Permissions', () => {
  test('Add New Role', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Roles
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Roles Roles' }).click();

    // expect: The Roles tab is displayed
    await expect(page.getByRole('tab', { name: 'Roles', selected: true })).toBeVisible();

    // 2. Click the add role button (+ icon in the Permissions header)
    const addRoleButton = page.getByRole('columnheader', { name: 'Permissions' }).locator('button').first();
    await addRoleButton.click();

    // expect: A dialog or form opens to create a new role
    // expect: Fields for role name are available
    // A new column should appear or a dialog opens for role name input

    // 3. Enter a role name and save (if dialog appears)
    // The UI may add a new column with an input field
    // expect: A new column is added to the permissions matrix
    // expect: The new role appears with no permissions assigned
  });
});
