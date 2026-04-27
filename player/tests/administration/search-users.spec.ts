// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Users', () => {
  test('Search Users', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Users
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Users Users' }).click();

    // expect: The Users section is displayed
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();

    // 2. Enter a user name in the Search field
    const searchField = page.getByRole('textbox', { name: 'Search' });
    await searchField.fill('Admin');

    // expect: The users list filters to show only matching users
    await expect(page.getByRole('cell', { name: 'Admin User' }).first()).toBeVisible();
  });
});
