// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Session Expiration', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin user
    // expect: User is authenticated
    await expect(page.getByText('My Views')).toBeVisible();

    // 2. Wait for the session to expire (or manipulate token expiration)
    // Clear all storage (cookies, localStorage, sessionStorage) to simulate token expiration
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Try to perform an action that requires authentication
    await page.reload();

    // expect: User is redirected to login page
    // After clearing all auth state and reloading, the OIDC client should redirect to Keycloak
    await expect(page).toHaveURL(/localhost:8443/, { timeout: 30000 });
  });
});
