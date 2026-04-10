// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services } from '../../fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication and Authorization', () => {
  test('Successful Authentication Flow', async ({ page }) => {

    // 1. Navigate to TopoMojo UI at http://localhost:4201
    await page.goto(Services.TopoMojo.UI);

    // expect: User is redirected to Keycloak login page at https://localhost:8443
    await expect(page).toHaveURL(/.*localhost:8443.*realms\/crucible/, { timeout: 70000 });

    // expect: Keycloak login form is displayed with username and password fields
    const usernameField = page.locator('#username');
    await expect(usernameField).toBeVisible({ timeout: 10000 });
    const passwordField = page.locator('#password');
    await expect(passwordField).toBeVisible();

    // 2. Enter valid username 'admin' in the username field
    await usernameField.fill('admin');

    // expect: Username field accepts input
    await expect(usernameField).toHaveValue('admin');

    // 3. Enter valid password 'admin' in the password field
    await passwordField.fill('admin');

    // expect: Password field accepts input and masks the password
    await expect(passwordField).toHaveValue('admin');
    await expect(passwordField).toHaveAttribute('type', 'password');

    // 4. Click the 'Sign In' button
    await page.click('#kc-login');

    // expect: User is authenticated and redirected back to TopoMojo UI at http://localhost:4201
    await page.waitForURL(/localhost:4201/, { timeout: 30000 });

    // expect: TopoMojo home page displays
    await page.waitForLoadState('domcontentloaded');

    // expect: User profile/menu is visible in top navigation
    const topNav = page.locator('mat-toolbar, [class*="topbar"], nav, header').first();
    await expect(topNav).toBeVisible({ timeout: 10000 });
  });
});
