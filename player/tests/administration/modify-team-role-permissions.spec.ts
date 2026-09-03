// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Roles and Permissions', () => {
  test('Modify Team Role Permissions', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Roles > Team Roles tab
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Roles Roles' }).click();
    await page.getByRole('tab', { name: 'Team Roles' }).click();

    // expect: The Team Roles permissions matrix is displayed
    await expect(page.getByRole('tab', { name: 'Team Roles', selected: true })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    // 2. Click a checkbox to assign or remove a permission from a team role
    const editTeamRow = page.getByRole('row').filter({ hasText: 'EditTeam' });
    const checkboxes = editTeamRow.getByRole('checkbox');
    const targetCheckbox = checkboxes.first();

    // Get the current state
    const wasChecked = await targetCheckbox.isChecked();

    // Click to toggle
    await targetCheckbox.click();

    // expect: The checkbox state toggles
    if (wasChecked) {
      await expect(targetCheckbox).not.toBeChecked();
    } else {
      await expect(targetCheckbox).toBeChecked();
    }

    // Revert the change to preserve test data
    await targetCheckbox.click();
  });
});
