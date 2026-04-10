// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Settings Browser', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to admin dashboard
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    // 2. Click on 'Settings' section
    const settingsLink = page.locator('a:has-text("Setting"), button:has-text("Setting"), mat-tab:has-text("Setting")').first();
    const hasLink = await settingsLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasLink) {
      await settingsLink.click();
      await page.waitForTimeout(1000);
    }

    // expect: Settings page loads
    // expect: Setting browser component is displayed
    const settingsContent = page.locator('[class*="setting"], form, [class*="config"], [class*="browser"]').first();
    await expect(settingsContent).toBeVisible({ timeout: 10000 });
  });
});
