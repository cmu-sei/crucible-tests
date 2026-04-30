// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services } from '../../fixtures';

// The Gameboard home page is public (unauthenticated users can browse).
// Authentication is triggered by navigating to /admin (or any protected route),
// which shows a 'Login — localhost:8443' button that redirects to Keycloak.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {
  test('Successful Authentication Flow', async ({ page }) => {
    // 1. Navigate to a protected route so Gameboard prompts for login.
    await page.goto(Services.Gameboard.UI + '/admin');
    // Expect the in-app login page with a Login button.
    await expect(page).toHaveURL(/\/login\?redirectTo=/);
    const loginBtn = page.locator('button:has-text("Login"), button:has-text("Log in")').first();
    await expect(loginBtn).toBeVisible({ timeout: 30000 });

    // 2. Click Login to be redirected to Keycloak.
    await loginBtn.click();
    await page.waitForURL(/\/realms\/crucible/, { timeout: 30000 });
    await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();

    // 3. Enter valid username.
    await page.getByRole('textbox', { name: 'Username or email' }).fill('admin');
    await expect(page.getByRole('textbox', { name: 'Username or email' })).toHaveValue('admin');

    // 4. Enter valid password.
    await page.getByRole('textbox', { name: 'Password' }).fill('admin');
    await expect(page.getByRole('textbox', { name: 'Password' })).toHaveValue('admin');

    // 5. Submit sign-in.
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Expect redirect back to Gameboard and authenticated navigation.
    await page.waitForURL(/localhost:4202/, { timeout: 30000 });
    // After login, the top nav shows Log out — a clear sign of authentication.
    await expect(page.locator('a:has-text("Log out"), button:has-text("Log out")').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('a:has-text("Admin")').first()).toBeVisible();
  });
});
