// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services } from '../../fixtures';

// Override global storageState so this test starts from a fresh unauthenticated state.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication and Authorization', () => {
  test('Successful Authentication Flow', async ({ page }) => {

    // 1. Navigate to CITE UI at http://localhost:4721
    await page.goto(Services.Cite.UI);

    // expect: User is redirected to Keycloak login page at https://localhost:8443
    await expect(page).toHaveURL(/.*localhost:8443/, { timeout: 70000 });

    // 2. Enter valid username 'admin' in the username field
    const usernameField = page.locator('#username');
    await usernameField.fill('admin');

    // expect: Username field accepts input
    await expect(usernameField).toHaveValue('admin');

    // 3. Enter valid password 'admin' in the password field
    const passwordField = page.locator('#password');
    await passwordField.fill('admin');

    // expect: Password field accepts input and masks the password
    await expect(passwordField).toHaveValue('admin');
    await expect(passwordField).toHaveAttribute('type', 'password');

    // 4. Click the 'Sign In' button
    await page.click('#kc-login');

    // expect: User is authenticated and redirected back to CITE UI at http://localhost:4721
    await page.waitForURL(/localhost:4721/, { timeout: 30000 });

    // expect: Home page displays with evaluation list
    await page.waitForLoadState('domcontentloaded');

    // expect: User profile/menu is visible in top bar
    const userMenu = page.locator('[class*="user"], [class*="profile"], mat-toolbar').first();
    await expect(userMenu).toBeVisible({ timeout: 10000 });
  });
});
