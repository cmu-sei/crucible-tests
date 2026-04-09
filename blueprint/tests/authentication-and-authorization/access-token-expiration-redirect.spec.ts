// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateBlueprintWithKeycloak } from '../../fixtures';

const OIDC_STORAGE_KEY = 'oidc.user:https://localhost:8443/realms/crucible:blueprint.ui';

test.describe('Authentication and Authorization', () => {
  test('Access Token Expiration Redirect', async ({ page }) => {
    // 1. Log in as admin user
    await authenticateBlueprintWithKeycloak(page, 'admin', 'admin');

    // expect: Successfully authenticated
    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 10000 });
    const topbarText = page.locator('text=Event Dashboard');
    await expect(topbarText).toBeVisible();

    // Wait for OIDC token to be stored in session storage
    await page.waitForFunction((key) => {
      return sessionStorage.getItem(key);
    }, OIDC_STORAGE_KEY, { timeout: 15000 });

    // 2. Manually invalidate the token by modifying it in session storage
    await page.evaluate((key) => {
      const userData = sessionStorage.getItem(key);
      if (userData) {
        const parsed = JSON.parse(userData);
        // Set the token to an invalid value
        parsed.access_token = 'invalid_token';
        // Set expiration to past time
        parsed.expires_at = Math.floor(Date.now() / 1000) - 1000;
        sessionStorage.setItem(key, JSON.stringify(parsed));
      }
    }, OIDC_STORAGE_KEY);

    // expect: Token expiration occurs
    const tokenExpired = await page.evaluate((key) => {
      const userData = sessionStorage.getItem(key);
      if (userData) {
        const parsed = JSON.parse(userData);
        const now = Math.floor(Date.now() / 1000);
        return parsed.expires_at < now;
      }
      return false;
    }, OIDC_STORAGE_KEY);
    expect(tokenExpired).toBe(true);

    // 3. Clear Keycloak session cookies so silent re-auth cannot succeed,
    //    then clear session storage and reload to simulate full token expiration
    await page.context().clearCookies();
    await page.evaluate((key) => sessionStorage.removeItem(key), OIDC_STORAGE_KEY);
    await page.reload();

    // expect: The application detects no valid session and redirects to Keycloak login page
    await expect(page).toHaveURL(/.*localhost:8443.*/, { timeout: 70000 });

    // expect: User must re-authenticate to continue
    const usernameField = page.locator('input[name="username"]');
    const passwordField = page.locator('input[name="password"]');
    await expect(usernameField).toBeVisible();
    await expect(passwordField).toBeVisible();

    // Verify the Blueprint content is not accessible
    const blueprintContent = page.locator('text=Event Dashboard');
    await expect(blueprintContent).not.toBeVisible();
  });
});
