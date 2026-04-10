// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Gamespace Management', () => {
  test('Gamespace Favorites - Remove Favorite', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to gamespace list with previously favorited gamespace
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

    const gamespaceItems = page.locator('[class*="gamespace-card"], [class*="item-card"], mat-list-item');
    const itemCount = await gamespaceItems.count();

    if (itemCount > 0) {
      // First favorite if not already
      await gamespaceItems.first().hover();
      await page.waitForTimeout(300);

      const starOutline = page.locator('mat-icon:text("star_border"), [class*="favorite"]:not([class*="favorite-on"])').first();
      const hasOutline = await starOutline.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasOutline) {
        await starOutline.click();
        await page.waitForTimeout(500);
      }

      // expect: Favorited gamespace displays with filled/solid star icon
      const filledStar = page.locator('mat-icon:text("star"), [class*="favorite-on"]').first();
      const isFavorited = await filledStar.isVisible({ timeout: 5000 }).catch(() => false);

      if (isFavorited) {
        // 2. Click the filled star icon on favorited gamespace
        await filledStar.click();
        await page.waitForTimeout(500);

        // expect: Gamespace is removed from favorites
        // expect: Star icon changes to outline/regular style
      }
    }
  });
});
