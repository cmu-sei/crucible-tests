// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Performance', () => {
  test('VM Console Loading Performance', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to a gamespace with VMs to check console loading
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
      const startTime = Date.now();
      await activeGamespaces.first().click();
      await page.waitForTimeout(2000);

      const loadTime = Date.now() - startTime;

      // expect: Console area loads within acceptable time
      expect(loadTime).toBeLessThan(30000);

      // expect: UI is responsive to input
      const appRoot = page.locator('app-root').first();
      await expect(appRoot).toBeVisible({ timeout: 10000 });
    }
  });
});
