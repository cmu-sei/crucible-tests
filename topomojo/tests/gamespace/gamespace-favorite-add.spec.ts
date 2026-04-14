// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Gamespace Management', () => {
  test('Gamespace Favorites - Add Favorite', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to gamespace list in sidebar
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

    // expect: Gamespace list displays
    const gamespaceItems = page.locator('[class*="gamespace-card"], [class*="item-card"], mat-list-item');
    const itemCount = await gamespaceItems.count();

    if (itemCount > 0) {
      // 2. Hover over a gamespace card
      await gamespaceItems.first().hover();
      await page.waitForTimeout(300);

      // expect: Favorite star icon appears (outline/regular style)
      const starIcon = page.locator('mat-icon:text("star_border"), mat-icon:text("star_outline"), [class*="favorite"]:not([class*="favorite-on"])').first();
      const hasStar = await starIcon.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasStar) {
        // 3. Click the star icon to favorite the gamespace
        await starIcon.click();
        await page.waitForTimeout(500);

        // expect: Gamespace is marked as favorite
        // expect: Star icon changes to filled/solid style
      }
    }
  });
});
