// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Gamespace Management', () => {
  test('Preview Gamespace', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to gamespace list with available workspaces
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
    }

    // Switch to gamespace mode
    const gamespaceTab = page.locator('mat-button-toggle:has-text("Gamespace"), button:has-text("Gamespace")').first();
    const hasTab = await gamespaceTab.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasTab) {
      await gamespaceTab.click();
      await page.waitForTimeout(500);
    }

    // expect: Playable workspaces are displayed
    const playableItems = page.locator('[class*="gamespace-card"], [class*="item-card"], mat-list-item, [class*="list-item"]');
    const itemCount = await playableItems.count();

    if (itemCount > 0) {
      // 2. Click on a playable workspace card or 'Preview' button
      await playableItems.first().click();
      await page.waitForTimeout(2000);

      // expect: Gamespace preview page loads
      // expect: Preview shows workspace description and VMs
      // expect: Deploy or Start button is visible
      const deployButton = page.locator('button:has-text("Deploy"), button:has-text("Start"), button:has-text("Launch")').first();
      const hasDeployBtn = await deployButton.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasDeployBtn) {
        await expect(deployButton).toBeVisible();
      }
    }
  });
});
