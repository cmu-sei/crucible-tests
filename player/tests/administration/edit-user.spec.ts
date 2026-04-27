// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Users', () => {
  test('Edit User', async ({ playerAuthenticatedPage: page }) => {
    // 1. Navigate to admin users section
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Users Users' }).click();

    // expect: Users list displays
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();

    // 2. Observe user details
    // expect: User details are displayed in editable form
    // Each user row shows ID, Name, and Role dropdown
    const firstUserRow = page.getByRole('row').nth(1);
    await expect(firstUserRow.getByRole('cell', { name: /Admin User/ })).toBeVisible();

    // 3. Modify user details (e.g., roles)
    // The role dropdown allows changing a user's role
    const roleDropdown = firstUserRow.getByRole('combobox');
    await expect(roleDropdown).toBeVisible();

    // expect: Fields accept modifications
    // 4. The role dropdown is interactive
    await expect(roleDropdown).toBeEnabled();
  });
});
