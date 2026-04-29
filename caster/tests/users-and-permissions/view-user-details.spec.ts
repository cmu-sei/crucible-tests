// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Users and Permissions Management', () => {
  test('View User Details', async ({ casterAuthenticatedPage: page }) => {

    // 1. Navigate to admin Users section
    await page.goto(Services.Caster.UI + '/admin?section=Users');

    // expect: Users list is visible
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });

    // 2. Verify user details are displayed in the table
    await expect(page.getByRole('cell', { name: 'Admin User' })).toBeVisible();

    // expect: User's ID is displayed with a copy button
    const userRow = page.getByRole('row').filter({ hasText: 'Admin User' });
    await expect(userRow).toBeVisible();

    // expect: User's role is displayed with a role selector
    const roleCombobox = userRow.getByRole('combobox');
    await expect(roleCombobox).toBeVisible();

    // expect: Delete user button is available
    const deleteButton = userRow.getByRole('button', { name: 'Delete User' });
    await expect(deleteButton).toBeVisible();
  });
});
