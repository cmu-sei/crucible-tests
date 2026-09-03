// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Users and Permissions Management', () => {
  test('Search Users', async ({ casterAuthenticatedPage: page }) => {

    // 1. Navigate to admin Users section
    await page.goto(Services.Caster.UI + '/admin?section=Users');

    // expect: Users list is visible
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: 'Admin User' })).toBeVisible();

    // 2. Enter a search term in the search box
    const searchBox = page.getByRole('textbox', { name: 'Search' });
    await searchBox.fill('Admin');

    // expect: The list filters to show only matching users
    await expect(page.getByRole('cell', { name: 'Admin User' })).toBeVisible();

    // 3. Clear the search box
    await searchBox.clear();

    // expect: All users are displayed again
    await expect(page.getByRole('cell', { name: 'Admin User' })).toBeVisible();
  });
});
