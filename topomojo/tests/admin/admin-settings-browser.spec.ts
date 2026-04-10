// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Settings Browser', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to home page first
    await page.goto(Services.TopoMojo.UI);
    await page.waitForLoadState('domcontentloaded');

    // Wait for either login button or Admin button to appear
    const loginButton = page.locator('button:has-text("Login"), button:has-text("identity provider")');
    const adminButton = page.getByRole('button', { name: 'Admin' });

    try {
      // Check which one appears first
      const result = await Promise.race([
        loginButton.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'login'),
        adminButton.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'admin'),
      ]);

      if (result === 'login') {
        // Need to log in
        await loginButton.click();

        // Fill in Keycloak credentials
        await page.waitForSelector('input[name="username"]', { timeout: 10000 });
        await page.fill('input[name="username"]', 'admin');
        await page.fill('input[name="password"]', 'admin');
        await page.click('button:has-text("Sign In")');

        // Wait for redirect back to TopoMojo
        await page.waitForURL(/localhost:4201/, { timeout: 30000 });
        await page.waitForLoadState('domcontentloaded');

        // Wait for Admin button to appear after authentication
        await adminButton.waitFor({ state: 'visible', timeout: 15000 });
      }
    } catch (e) {
      // If neither appeared, throw an error
      throw new Error('Neither login button nor admin button appeared on the page');
    }

    // 2. Click on Admin button in navigation
    await adminButton.click();

    // Wait for admin dashboard to load
    await page.waitForURL(/\/admin/, { timeout: 10000 });

    // 3. Click on 'Settings' link
    const settingsLink = page.getByRole('link', { name: 'Settings' });
    await settingsLink.waitFor({ state: 'visible', timeout: 10000 });
    await settingsLink.click();

    // expect: Settings page loads
    await page.waitForURL(/\/admin\/settings/, { timeout: 10000 });

    // expect: Setting browser component is displayed
    const settingsContent = page.locator('app-setting-browser');
    await expect(settingsContent).toBeVisible({ timeout: 10000 });

    // Verify the background image section is present
    const backgroundHeading = page.getByRole('heading', { name: 'Background Image' });
    await expect(backgroundHeading).toBeVisible();
  });
});
