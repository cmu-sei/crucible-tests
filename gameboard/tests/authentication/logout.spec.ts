// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Authentication', () => {
  test('Logout Functionality', async ({ gameboardAuthenticatedPage: page }) => {
    // 1. Start authenticated on home.
    await page.goto(Services.Gameboard.UI);
    await expect(page.locator('a:has-text("Log out"), button:has-text("Log out")').first()).toBeVisible({ timeout: 15000 });

    // 2/3. Click Log out. In Gameboard the logout link lives directly in the top nav (no profile dropdown in the default layout).
    await page.locator('a:has-text("Log out"), button:has-text("Log out")').first().click();

    // Gameboard logout flows through Keycloak's end-session endpoint and back.
    // Wait for the session to clear — Log out link disappears once we are unauthenticated.
    await expect(page.locator('a:has-text("Log out"), button:has-text("Log out")').first()).toBeHidden({ timeout: 30000 });

    // 4. Attempt to access a protected route — must prompt for login again.
    // Wait for any ongoing navigation to settle first.
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(1000);
    await page.goto(Services.Gameboard.UI + '/admin', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login\?redirectTo=/);
    await expect(page.locator('button:has-text("Login"), button:has-text("Log in")').first()).toBeVisible({ timeout: 15000 });
  });
});
