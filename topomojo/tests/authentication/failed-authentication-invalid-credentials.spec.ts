// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services } from '../../fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication and Authorization', () => {
  test('Failed Authentication - Invalid Credentials', async ({ page }) => {

    // 1. Navigate to TopoMojo UI at http://localhost:4201
    await page.goto(Services.TopoMojo.UI);

    // expect: TopoMojo landing page is displayed with login button
    await page.waitForLoadState('domcontentloaded');
    const loginButton = page.getByRole('button', { name: 'identity provider' });
    await expect(loginButton).toBeVisible({ timeout: 10000 });

    // 1b. Click the login button to redirect to Keycloak
    await loginButton.click();

    // expect: User is redirected to Keycloak login page
    await expect(page).toHaveURL(/.*localhost:8443.*realms\/crucible/, { timeout: 30000 });

    // 2. Enter invalid username 'invaliduser' in the username field
    const usernameField = page.locator('#username');
    await usernameField.fill('invaliduser');

    // expect: Username field accepts input
    await expect(usernameField).toHaveValue('invaliduser');

    // 3. Enter invalid password 'wrongpassword' in the password field
    const passwordField = page.locator('#password');
    await passwordField.fill('wrongpassword');

    // expect: Password field accepts input
    await expect(passwordField).toHaveValue('wrongpassword');

    // 4. Click the 'Sign In' button
    await page.click('#kc-login');

    // expect: Authentication fails
    // expect: Error message is displayed indicating invalid credentials
    const errorMessage = page.locator('#input-error, [class*="alert"], [class*="error"]').first();
    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    // expect: User remains on Keycloak login page
    await expect(page).toHaveURL(/.*localhost:8443.*realms\/crucible/);
  });
});
