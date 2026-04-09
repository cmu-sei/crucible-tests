// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services } from '../../fixtures';

// Override global storageState so this test starts from a fresh unauthenticated state.
// The login flow test must not rely on pre-authentication or stored sessions.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication and Authorization', () => {
  test('User Login Flow', async ({ page }) => {

    // 1. Navigate to http://localhost:4725
    await page.goto(Services.Blueprint.UI);

    // expect: The application redirects to the Keycloak authentication page at https://localhost:8443/realms/crucible
    // Note: Blueprint tries silent auth renewal first (iframe), which takes ~10s to fail before full redirect
    await expect(page).toHaveURL(/.*localhost:8443.*realms\/crucible/, { timeout: 70000 });

    // 2. Enter username 'admin' in the username field
    const usernameField = page.locator('#username');
    await usernameField.fill('admin');

    // expect: The username field accepts input
    await expect(usernameField).toHaveValue('admin');

    // 3. Enter password 'admin' in the password field
    const passwordField = page.locator('#password');
    await passwordField.fill('admin');

    // expect: The password field accepts input and masks the password
    await expect(passwordField).toHaveValue('admin');
    await expect(passwordField).toHaveAttribute('type', 'password');

    // 4. Click the 'Sign In' button
    await page.click('#kc-login');

    // expect: The application authenticates successfully
    // expect: The user is redirected back to http://localhost:4725
    await page.waitForURL(/localhost:4725/, { timeout: 30000 });

    // expect: The main application interface loads
    await page.waitForLoadState('domcontentloaded');

    // expect: The topbar displays 'Event Dashboard'
    const topbarText = page.locator('text=Event Dashboard');
    await expect(topbarText).toBeVisible({ timeout: 10000 });

    // expect: The username 'admin' is displayed in the topbar
    // Note: Blueprint displays the full name 'Admin User' for the 'admin' account
    const nameDisplay = page.locator('text=Admin User').first();
    await expect(nameDisplay).toBeVisible();

    // expect: A Blueprint icon button is visible in the topbar that links to home
    const blueprintIconLink = page.locator('a[href="/"]').first();
    await expect(blueprintIconLink).toBeVisible();
  });
});
