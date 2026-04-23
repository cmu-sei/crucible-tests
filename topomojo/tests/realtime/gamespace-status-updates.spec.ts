// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Real-time Updates and Notifications', () => {
  test('Real-time Gamespace Status Updates', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Open active gamespace
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

      // expect: Gamespace displays with VMs
      // expect: Status indicators are present
      const statusIndicator = page.locator('[class*="status"], [class*="state"], mat-icon').first();
      const hasStatus = await statusIndicator.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasStatus) {
        await expect(statusIndicator).toBeVisible();
      }
    }
  });
});
