// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling', () => {
  test('API Error Handling - Server Error (500)', async ({ gameboardAuthenticatedPage: page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Load the admin page while the API answers normally. Gameboard's admin guard reads
    // the signed-in user's roles from the API, so failing it before the app loads makes
    // the app send the user to /forbidden — which tests the guard, not error handling.
    await page.goto(Services.Gameboard.UI + '/admin/overview', { waitUntil: 'domcontentloaded' });
    const adminNav = page.locator('nav').filter({ has: page.getByRole('link', { name: 'Live', exact: true }) });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 15000 });

    // Answer every API call with a 500 from here on.
    await page.route(Services.Gameboard.API + '/api/**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"synthetic"}' })
    );
    const failed = page.waitForResponse(
      (response) => response.url().startsWith(Services.Gameboard.API + '/api/') && response.status() === 500,
      { timeout: 15000 }
    );

    // Navigate within the app, so the Users page's API calls get the 500.
    await adminNav.getByRole('link', { name: 'Users', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/registrar\/users/);
    await failed;

    // App should still be navigable — Administration shell remains.
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 15000 });
    // No uncaught JS errors from the 500 response.
    expect(errors, `unexpected page errors: ${errors.join('; ')}`).toEqual([]);
  });
});
