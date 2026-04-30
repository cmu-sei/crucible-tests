// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Authentication', () => {
  test('Session Persistence After Refresh', async ({ gameboardAuthenticatedPage: page }) => {
    // 1. Arrive authenticated (fixture logs in).
    await page.goto(Services.Gameboard.UI + '/admin');
    await expect(page).toHaveURL(/localhost:4202\/admin/);
    await expect(page.locator('a:has-text("Log out"), button:has-text("Log out")').first()).toBeVisible();

    // 2. Refresh.
    await page.reload();

    // Expect: still authenticated, not redirected to Keycloak.
    await expect(page).toHaveURL(/localhost:4202/);
    await expect(page).not.toHaveURL(/localhost:8443/);
    await expect(page.locator('a:has-text("Log out"), button:has-text("Log out")').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
