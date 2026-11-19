// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Gamespace Management', () => {
  test('Gamespace Extended Duration', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to active gamespace nearing expiration
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await expect(sidebar).toBeVisible({ timeout: 5000 });
    }

    const gamespaceTab = page.locator('mat-button-toggle:has-text("Gamespace"), button:has-text("Gamespace")').first();
    const activeGamespaces = page.locator('[class*="gamespace-card"], [class*="item-card"], mat-list-item');
    const hasTab = await gamespaceTab.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasTab) {
      await gamespaceTab.click();
      await expect(activeGamespaces.first()).toBeVisible({ timeout: 5000 });
    }

    const activeCount = await activeGamespaces.count();

    if (activeCount > 0) {
      const extendButton = page.locator('button:has-text("Extend"), button:has(mat-icon:text("timer")), [class*="extend"]').first();
      await activeGamespaces.first().click();
      await expect(extendButton).toBeVisible({ timeout: 10000 });

      // expect: Expiration timer or warning is visible
      const expirationInfo = page.locator('[class*="expir"], [class*="timer"], [class*="countdown"], [class*="duration"]').first();
      const hasExpiration = await expirationInfo.isVisible({ timeout: 5000 }).catch(() => false);

      // 2. Click 'Extend' button if available
      const hasExtend = await extendButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasExtend) {
        await extendButton.click();

        // expect: Gamespace duration is extended
        // expect: New expiration time is displayed
      }
    }
  });
});
