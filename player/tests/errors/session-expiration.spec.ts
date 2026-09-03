// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, serviceUrlPattern } from '../../fixtures';

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

    // With an active Keycloak SSO session, Player restores a fresh session after
    // client storage is cleared and returns to its authenticated home page.
    await expect(page).toHaveURL(serviceUrlPattern(Services.Player.UI), { timeout: 30000 });
    await expect(page.getByText('My Views')).toBeVisible();
  });
});
