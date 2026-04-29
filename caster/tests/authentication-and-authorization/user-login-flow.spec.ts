// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services } from '../../fixtures';

// Override global storageState so this test starts from a fresh unauthenticated state.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication and Authorization', () => {
  test('User Login Flow', async ({ page }) => {

    // 1. Navigate to http://localhost:4310
    await page.goto(Services.Caster.UI);

    // expect: The application redirects to the Keycloak authentication page at https://localhost:8443/realms/crucible
    await expect(page).toHaveURL(/.*localhost:8443.*realms\/crucible/, { timeout: 70000 });
    await expect(page.getByText('Sign in to your account')).toBeVisible();

    // 2. Enter username 'admin' in the username field
    const usernameField = page.getByRole('textbox', { name: 'Username or email' });
    await usernameField.fill('admin');

    // expect: The username field accepts input
    await expect(usernameField).toHaveValue('admin');

    // 3. Enter password 'admin' in the password field
    const passwordField = page.getByRole('textbox', { name: 'Password' });
    await passwordField.fill('admin');

    // expect: The password field accepts input and masks the password
    await expect(passwordField).toHaveValue('admin');

    // 4. Click the 'Sign In' button
    await page.getByRole('button', { name: 'Sign In' }).click();

    // expect: The application authenticates successfully
    // expect: The user is redirected back to http://localhost:4310
    await expect(page).toHaveURL(/localhost:4310/, { timeout: 30000 });

    // expect: The main application interface loads
    // expect: The topbar displays 'Caster' branding
    await expect(page.getByText('Caster').first()).toBeVisible({ timeout: 10000 });

    // expect: The topbar displays the username 'admin'
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();
  });
});
