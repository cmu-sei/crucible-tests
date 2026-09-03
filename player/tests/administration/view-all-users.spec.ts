// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Users', () => {
  test('View All Users', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();

    // expect: The Administration page is displayed
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // 2. Click the 'Users' button
    await page.getByRole('button', { name: 'Users Users' }).click();

    // expect: The Users section is displayed
    await expect(page).toHaveURL(/section=users/);

    // expect: A table shows users with columns: ID, Name, Role
    await expect(page.getByRole('columnheader', { name: 'ID' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Role' })).toBeVisible();

    // expect: Each user has a copy button for their ID
    const copyButton = page.getByRole('button', { name: /^Copy:/ }).first();
    await expect(copyButton).toBeVisible();

    // expect: Each user has a role dropdown and delete button
    await expect(page.getByRole('combobox').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete User' }).first()).toBeVisible();
  });
});
