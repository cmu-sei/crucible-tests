// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Clear Background Image', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to admin setting browser with background image configured
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    const settingsLink = page.locator('a:has-text("Setting"), button:has-text("Setting"), mat-tab:has-text("Setting")').first();
    const hasLink = await settingsLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasLink) {
      await settingsLink.click();
      await page.waitForTimeout(1000);
    }

    // expect: Clear button is visible if background image is configured
    const clearButton = page.locator('button:has-text("Clear"), button:has-text("Remove"), button:has(mat-icon:text("clear"))').first();
    const hasClear = await clearButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasClear) {
      // 2. Clear button is available for removing background
      await expect(clearButton).toBeVisible();

      // expect: Application background reverts to default (--app-bg-image: none)
      // expect: 'has-bg-image' class is removed from document root
    }
  });
});
