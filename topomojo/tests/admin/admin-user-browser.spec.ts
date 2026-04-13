// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - User Browser', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. The fixture should have authenticated, but Angular app may need time to initialize
    // Wait for either authenticated state (Admin button) or login prompt
    const adminButton = page.getByRole('button', { name: 'Admin' });
    const loginButton = page.getByRole('button', { name: 'identity provider' });

    // Race between Admin button appearing (authenticated) or login button appearing (needs auth)
    const winner = await Promise.race([
      adminButton.waitFor({ state: 'visible', timeout: 30000 }).then(() => 'authenticated'),
      loginButton.waitFor({ state: 'visible', timeout: 30000 }).then(() => 'needsAuth')
    ]).catch(() => 'timeout');

    // If we need to authenticate, click the login button and go through Keycloak
    if (winner === 'needsAuth') {
      await loginButton.click();
      await page.waitForURL(/8443.*realms\/crucible/, { timeout: 10000 });
      await page.fill('input[name="username"]', 'admin');
      await page.fill('input[name="password"]', 'admin');
      await page.click('button:has-text("Sign In")');
      await page.waitForURL(/localhost:4201/, { timeout: 30000 });
      // Wait for admin button to appear after auth
      await adminButton.waitFor({ state: 'visible', timeout: 30000 });
    } else if (winner === 'timeout') {
      throw new Error('Timeout waiting for either Admin button or Login button to appear');
    }

    // Click Admin button to access admin dashboard
    await adminButton.click();
    await page.waitForLoadState('domcontentloaded');

    // expect: Admin menu is visible
    const adminHeading = page.getByRole('heading', { name: 'Admin Dashboard' });
    await expect(adminHeading).toBeVisible({ timeout: 10000 });

    // 2. Click on 'Users' section
    // Start listening for the users API response before clicking, so we don't miss it
    const usersApiResponse = page.waitForResponse(
      resp => resp.url().includes('/users') && resp.status() === 200,
      { timeout: 15000 }
    );
    const usersLink = page.getByRole('link', { name: 'Users' });
    await usersLink.click();
    await usersApiResponse;

    // expect: User browser page loads
    await expect(page).toHaveURL(/\/admin\/users/);
    const userBrowserComponent = page.locator('app-user-browser');
    await expect(userBrowserComponent).toBeVisible({ timeout: 10000 });

    // expect: List of users is displayed
    const usersHeading = page.getByRole('heading', { name: 'Users', level: 4 });
    await expect(usersHeading).toBeVisible();

    // expect: User details include name, role, and created date
    const userRows = page.locator('.row.mb-1');
    await expect(userRows.first()).toBeVisible({ timeout: 10000 });
  });
});
