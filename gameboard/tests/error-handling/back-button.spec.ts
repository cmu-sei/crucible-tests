// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling', () => {
  test('Browser Back Button Navigation', async ({ gameboardAuthenticatedPage: page }) => {
    // Prime the admin guard. On a freshly-authenticated page, the Angular
    // AdminGuard reads `localUser.user$` — which emits `null` before the
    // profile call returns — and redirects to /forbidden. That redirect
    // inserts extra history entries that break a later goBack sequence. We
    // visit /admin first and wait for the URL to stabilize on /admin/* (not
    // /forbidden) so subsequent navigations don't trip the guard race.
    await page.goto(Services.Gameboard.UI + '/admin', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/admin(\/|$)/);
    await expect(page).not.toHaveURL(/\/forbidden/);

    // Navigate through routes that don't require admin permissions — /home
    // and /support are public, so goBack isn't fighting guard redirects.
    await page.goto(Services.Gameboard.UI + '/home', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/home/);

    await page.goto(Services.Gameboard.UI + '/support', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/support/);

    await page.goto(Services.Gameboard.UI + '/user/profile', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/user\/profile/);

    // Click browser back — should return to previous page without errors.
    await page.goBack();
    await expect(page).toHaveURL(/\/support/, { timeout: 10000 });

    await page.goBack();
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });

    // Top nav chrome remains intact after back navigation.
    await expect(page.locator('a:has-text("Log out"), button:has-text("Log out")').first()).toBeVisible();
  });
});
