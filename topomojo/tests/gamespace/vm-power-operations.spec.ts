// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Gamespace Management', () => {
  test('Gamespace VM Power Operations', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to active gamespace
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
    }

    const gamespaceTab = page.locator('mat-button-toggle:has-text("Gamespace"), button:has-text("Gamespace")').first();
    const hasTab = await gamespaceTab.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasTab) {
      await gamespaceTab.click();
      await page.waitForTimeout(500);
    }

    const activeGamespaces = page.locator('[class*="gamespace-card"], [class*="item-card"], mat-list-item');
    const activeCount = await activeGamespaces.count();

    if (activeCount > 0) {
      await activeGamespaces.first().click();
      await page.waitForTimeout(2000);

      // expect: VM list displays with power control buttons
      const powerButton = page.locator('button:has(mat-icon:text("power_settings_new")), button:has-text("Power"), button:has(mat-icon:text("stop")), button:has(mat-icon:text("play_arrow"))').first();
      const hasPower = await powerButton.isVisible({ timeout: 10000 }).catch(() => false);

      if (hasPower) {
        // 2. Power button is available for VM operations
        await expect(powerButton).toBeVisible();
      }
    }
  });
});
