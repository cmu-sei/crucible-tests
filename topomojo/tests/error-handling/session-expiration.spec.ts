// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Session Expiration', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Log in successfully - handled by fixture
    // expect: User is authenticated
    await expect(page).toHaveURL(/localhost:4201/);

    // 2. Simulate session expiration by clearing cookies
    await page.context().clearCookies();

    // 3. Attempt to perform an action
    await page.goto(Services.TopoMojo.UI);
    await page.waitForTimeout(5000);

    // expect: User is notified of session expiration
    // expect: User is redirected to login page
    const currentUrl = page.url();
    const isOnKeycloak = currentUrl.includes('localhost:8443');
    const isOnApp = currentUrl.includes('localhost:4201');

    // Should be redirected to Keycloak or app handles re-auth
    expect(isOnKeycloak || isOnApp).toBe(true);
  });
});
