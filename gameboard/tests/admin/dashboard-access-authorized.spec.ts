// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin - Games', () => {
  test('Admin Dashboard Access - Authorized', async ({ gameboardAuthenticatedPage: page }) => {
    await page.goto(Services.Gameboard.UI + '/admin', { waitUntil: 'domcontentloaded' });
    // Admin lands on /admin/dashboard (Games tab).
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // Admin navigation tabs are visible.
    await expect(page.locator('a:has-text("Live")').first()).toBeVisible();
    await expect(page.locator('a:has-text("Games")').first()).toBeVisible();
    await expect(page.locator('a:has-text("Users")').first()).toBeVisible();

    // "New Game" action is available.
    await expect(page.getByRole('button', { name: /New Game/i })).toBeVisible();
  });
});
