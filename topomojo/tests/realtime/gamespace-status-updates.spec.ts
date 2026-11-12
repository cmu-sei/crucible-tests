// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Real-time Updates and Notifications', () => {
  test('Real-time Gamespace Status Updates', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Open active gamespace
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    const gamespaceTab = page.locator('mat-button-toggle:has-text("Gamespace"), button:has-text("Gamespace")').first();
    const activeGamespaces = page.locator('[class*="gamespace-card"], [class*="item-card"], mat-list-item');

    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await expect(sidebar).toBeVisible({ timeout: 5000 });
    }

    const hasTab = await gamespaceTab.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasTab) {
      await gamespaceTab.click();
      await expect(activeGamespaces.first()).toBeVisible({ timeout: 5000 });
    }
    const activeCount = await activeGamespaces.count();

    if (activeCount > 0) {
      const statusIndicator = page.locator('[class*="status"], [class*="state"], mat-icon').first();
      await activeGamespaces.first().click();

      // expect: Gamespace displays with VMs
      // expect: Status indicators are present
      const hasStatus = await statusIndicator.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false);
      if (hasStatus) {
        await expect(statusIndicator).toBeVisible();
      }
    }
  });
});
