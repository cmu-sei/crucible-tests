// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin - Users', () => {
  test('Search Users', async ({ gameboardAuthenticatedPage: page }) => {
    await page.goto(Services.Gameboard.UI + '/admin/registrar/users', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible({ timeout: 15000 });

    const searchBox = page.locator('input[type="search"]').first();
    await expect(searchBox).toBeVisible();

    // Search for a string unlikely to match any seeded user.
    await searchBox.fill('zzzzzzzzzzz_nonexistent');
    await page.waitForTimeout(1500);
    // Page should still be on the Users admin and not throw.
    await expect(page).toHaveURL(/\/admin\/registrar\/users/);

    // Now clear and search for "admin" which should return at least one result.
    await searchBox.fill('');
    await searchBox.fill('admin');
    await page.waitForTimeout(1500);
    // Admin's display name or count indicator should be present.
    await expect(page.locator('text=/count:/i').first()).toBeVisible({ timeout: 10000 });
  });
});
