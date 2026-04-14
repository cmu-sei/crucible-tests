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

    // Wait for Admin button to confirm authentication (fixture already authenticated)
    // The Admin button only appears after auth state is set - wait generously to avoid race conditions
    const adminButton = page.getByRole('button', { name: 'Admin' });

    try {
      await adminButton.waitFor({ state: 'visible', timeout: 30000 });
    } catch (e) {
      throw new Error(`Admin button did not appear within 30 seconds. Current URL: ${page.url()}`);
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
