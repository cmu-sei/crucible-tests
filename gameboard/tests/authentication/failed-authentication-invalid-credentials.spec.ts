// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services } from '../../fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {
  test('Failed Authentication - Invalid Credentials', async ({ page }) => {
    // 1. Trigger login by navigating to /admin.
    await page.goto(Services.Gameboard.UI + '/admin');
    const loginBtn = page.locator('button:has-text("Login"), button:has-text("Log in")').first();
    await loginBtn.waitFor({ state: 'visible', timeout: 30000 });
    await loginBtn.click();
    await page.waitForURL(/\/realms\/crucible/, { timeout: 30000 });

    // 2/3. Enter invalid credentials.
    await page.getByRole('textbox', { name: 'Username or email' }).fill('wronguser');
    await page.getByRole('textbox', { name: 'Password' }).fill('wrongpass');

    // 4. Submit sign-in.
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Expect: error message displayed, still on Keycloak login.
    const errorMessage = page.locator('.alert-error, #input-error, .kc-feedback-text, [aria-live="polite"]').first();
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/localhost:8443/);
    await expect(page.getByRole('textbox', { name: 'Username or email' })).toBeVisible();
  });
});
