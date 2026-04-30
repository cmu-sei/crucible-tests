// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

// Simulates an expired session by clearing storage/cookies and verifying the
// user is re-prompted for authentication on protected routes.
test.describe('Error Handling', () => {
  test('Session Timeout', async ({ gameboardAuthenticatedPage: page, context }) => {
    await page.goto(Services.Gameboard.UI + '/admin');
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 15000 });

    // Clear storage and cookies to simulate session expiration.
    await context.clearCookies();
    await page.evaluate(() => {
      try { window.localStorage.clear(); } catch {}
      try { window.sessionStorage.clear(); } catch {}
    });

    // Navigate to a protected route — user should be redirected to the in-app login page.
    await page.goto(Services.Gameboard.UI + '/admin', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login\?redirectTo=/, { timeout: 15000 });
    await expect(page.locator('button:has-text("Login"), button:has-text("Log in")').first()).toBeVisible();
  });
});
