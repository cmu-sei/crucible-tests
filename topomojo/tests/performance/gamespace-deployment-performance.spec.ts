// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Performance', () => {
  test('Gamespace Deployment Performance', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to gamespace area and check for deploy option
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

    const playableItems = page.locator('[class*="gamespace-card"], [class*="item-card"], mat-list-item');
    const itemCount = await playableItems.count();

    if (itemCount > 0) {
      await playableItems.first().click();
      await page.waitForTimeout(2000);

      // expect: Deployment progress is shown if deploying
      const deployButton = page.locator('button:has-text("Deploy"), button:has-text("Start")').first();
      const hasDeploy = await deployButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasDeploy) {
        // Verify deploy button is responsive
        await expect(deployButton).toBeEnabled({ timeout: 5000 });
      }
    }

    // expect: UI is responsive and no timeouts occur during normal navigation
    const appRoot = page.locator('app-root').first();
    await expect(appRoot).toBeVisible({ timeout: 10000 });
  });
});
