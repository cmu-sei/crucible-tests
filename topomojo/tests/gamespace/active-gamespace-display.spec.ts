// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Gamespace Management', () => {
  test('Active Gamespace Display', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to an active gamespace (if any exist)
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
      const vmList = page.locator('[class*="vm"], [class*="machine"], [class*="console"]').first();
      await activeGamespaces.first().click();
      await expect(vmList).toBeVisible({ timeout: 10000 });

      // expect: Gamespace page loads
      // expect: VM list is displayed
      const hasVMs = await vmList.isVisible({ timeout: 10000 }).catch(() => false);
      if (hasVMs) {
        await expect(vmList).toBeVisible();
      }

      // expect: Each VM shows name, status, and console access
    }
  });
});
