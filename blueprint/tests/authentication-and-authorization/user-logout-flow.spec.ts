// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Authentication and Authorization', () => {
  test('User Logout Flow', async ({ blueprintAuthenticatedPage: page }) => {

    // expect: Successfully authenticated and viewing the home page
    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 10000 });
    const topbarText = page.locator('text=Event Dashboard');
    await expect(topbarText).toBeVisible();

    // 2. Click on the user menu in the topbar
    const userMenu = page.getByRole('button', { name: /Admin User/i });
    await userMenu.click();

    // expect: A dropdown menu appears with logout option
    const logoutOption = page.getByRole('menuitem', { name: 'Logout' })
    await expect(logoutOption).toBeVisible({ timeout: 3000 });

    // 3. Click 'Logout' option
    await logoutOption.click();

    // expect: The user is logged out
    // expect: Authentication tokens are cleared from local storage
    await page.waitForTimeout(1000); // Allow time for logout to complete

    const sessionStorageKeys = await page.evaluate(() => {
      return Object.keys(sessionStorage).filter(key =>
        key.includes('auth') ||
        key.includes('token') ||
        key.includes('oidc')
      );
    });
    expect(sessionStorageKeys.length).toBe(0);

    // expect: The user is redirected to the Keycloak logout page or login page
    await expect(page).toHaveURL(/.*localhost:8443.*/, { timeout: 70000 });

    // Verify user cannot access Blueprint without re-authenticating
    await page.goto(Services.Blueprint.UI);
    await expect(page).toHaveURL(/.*localhost:8443.*/, { timeout: 70000 });
  });
});
