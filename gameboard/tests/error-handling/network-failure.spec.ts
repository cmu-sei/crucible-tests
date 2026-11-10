// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling', () => {
  test('API Error Handling - Network Failure', async ({ gameboardAuthenticatedPage: page }) => {
    // Load the admin page while the API is reachable. Gameboard's admin guard reads the
    // signed-in user's roles from the API, so blocking it before the app loads makes the
    // app send the user to /forbidden — which tests the guard, not error handling.
    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'domcontentloaded' });
    const adminNav = page.locator('nav').filter({ has: page.getByRole('link', { name: 'Live', exact: true }) });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 15000 });

    // Block all Gameboard API calls and verify the app does not crash.
    await page.route(Services.Gameboard.API + '/**', (route) => route.abort('failed'));
    const blocked = page.waitForEvent('requestfailed', {
      predicate: (request) => request.url().startsWith(Services.Gameboard.API),
      timeout: 15000,
    });

    // Navigate within the app, so the next admin page's API calls fail.
    await adminNav.getByRole('link', { name: 'Live', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/overview/);
    await blocked;

    // Even with API calls blocked, the SPA chrome (topbar, admin nav) should still render.
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 15000 });
    // The app should not have crashed into a blank/white screen — the Log out link remains visible.
    await expect(page.locator('a:has-text("Log out"), button:has-text("Log out")').first()).toBeVisible();
  });
});
