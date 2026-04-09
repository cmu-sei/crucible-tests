// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services } from '../../fixtures';

// Override global storageState so this test starts from a fresh unauthenticated state.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication and Authorization', () => {
  test('Failed Authentication - Invalid Credentials', async ({ page }) => {

    // 1. Navigate to CITE UI at http://localhost:4721
    await page.goto(Services.Cite.UI);

    // expect: User is redirected to Keycloak login page
    await expect(page).toHaveURL(/.*localhost:8443/, { timeout: 70000 });

    // 2. Enter invalid username 'wronguser' in the username field
    const usernameField = page.locator('#username');
    await usernameField.fill('wronguser');

    // expect: Username field accepts input
    await expect(usernameField).toHaveValue('wronguser');

    // 3. Enter invalid password 'wrongpass' in the password field
    const passwordField = page.locator('#password');
    await passwordField.fill('wrongpass');

    // expect: Password field accepts input
    await expect(passwordField).toHaveValue('wrongpass');

    // 4. Click the 'Sign In' button
    await page.click('#kc-login');

    // expect: Authentication fails
    // expect: Error message is displayed indicating invalid credentials
    const errorMessage = page.locator('.alert-error, #input-error, .kc-feedback-text');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // expect: User remains on Keycloak login page
    await expect(page).toHaveURL(/.*localhost:8443/, { timeout: 5000 });
  });
});
