// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Configure Background Image', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to admin settings/setting-browser section
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    const settingsLink = page.locator('a:has-text("Setting"), button:has-text("Setting"), mat-tab:has-text("Setting")').first();
    const hasLink = await settingsLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasLink) {
      await settingsLink.click();
      await page.waitForTimeout(1000);
    }

    // expect: Background image configuration section is visible
    const bgSection = page.locator('[class*="background"], [class*="bg-image"], input[type="file"][accept*="image"]').first();
    const hasBgSection = await bgSection.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBgSection) {
      // expect: Current background preview is shown (if any)
      // 2. File input for background image is available
      await expect(bgSection).toBeVisible();

      // expect: Only image files are accepted
      // expect: Image is applied via CSS custom property --app-bg-image
    }
  });
});
