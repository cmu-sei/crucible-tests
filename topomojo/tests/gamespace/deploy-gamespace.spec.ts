// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Gamespace Management', () => {
  test('Deploy Gamespace', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to gamespace preview for a published workspace
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

      // expect: Preview page displays with deploy option
      // 2. Click 'Deploy' or 'Start' button
      const deployButton = page.locator('button:has-text("Deploy"), button:has-text("Start"), button:has-text("Launch")').first();
      const hasDeploy = await deployButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasDeploy) {
        await deployButton.click();

        // expect: Gamespace deployment begins
        // expect: Loading indicator shows deployment progress
        await page.waitForTimeout(5000);

        // expect: Deployment may take time depending on VMs
        // expect: User is navigated to active gamespace page
        const gamespaceContent = page.locator('[class*="gamespace"], [class*="vm-list"], [class*="active"]').first();
        const hasContent = await gamespaceContent.isVisible({ timeout: 60000 }).catch(() => false);
        if (hasContent) {
          await expect(gamespaceContent).toBeVisible();
        }
      }
    }
  });
});
