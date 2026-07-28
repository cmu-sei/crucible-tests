// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services, serviceUrlPattern } from '../../fixtures';

// Override global storageState so this test starts from a fresh unauthenticated
// state. The login flow test must exercise the real Keycloak round-trip and must
// not rely on the pre-authenticated state from global-setup.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication and Authorization', () => {
  test('User Login Flow', async ({ page }) => {
    // 1. Navigate to the Steamfitter UI
    await page.goto(Services.Steamfitter.UI);

    // expect: The application redirects to the Keycloak authentication page.
    // The Angular OIDC client may attempt silent renewal (iframe) first, so allow
    // a generous window for the full redirect to Keycloak.
    await expect(page).toHaveURL(serviceUrlPattern(Services.Keycloak), { timeout: 70000 });

    // 2. Enter username 'admin'
    const usernameField = page.locator('#username');
    await usernameField.fill('admin');
    await expect(usernameField).toHaveValue('admin');

    // 3. Enter password 'admin'
    const passwordField = page.locator('#password');
    await passwordField.fill('admin');
    await expect(passwordField).toHaveValue('admin');
    await expect(passwordField).toHaveAttribute('type', 'password');

    // 4. Click the 'Sign In' button
    await page.click('#kc-login');

    // expect: The user is redirected back to the Steamfitter UI
    await page.waitForURL(serviceUrlPattern(Services.Steamfitter.UI), { timeout: 30000 });
    await page.waitForLoadState('domcontentloaded');

    // expect: The Steamfitter application shell (topbar) loads
    const topbar = page.locator('app-topbar mat-toolbar').first();
    await expect(topbar).toBeVisible({ timeout: 20000 });

    // expect: The document title is 'Steamfitter'
    await expect(page).toHaveTitle('Steamfitter', { timeout: 10000 });

    // expect: The topbar displays the application title
    await expect(topbar.getByText('Steamfitter')).toBeVisible();

    // expect: The authenticated user's name 'Admin User' appears in the topbar menu
    await expect(page.getByRole('button', { name: /Admin User/ })).toBeVisible({ timeout: 10000 });

    // expect: The topbar Home icon links back to the app root
    await expect(page.locator('a[title="Home"]').first()).toBeVisible();
  });
});
