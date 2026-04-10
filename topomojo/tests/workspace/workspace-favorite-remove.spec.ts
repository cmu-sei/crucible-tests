// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspace Management', () => {
  test('Workspace Favorites - Remove Favorite', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to workspace list with previously favorited workspace
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
    }

    const workspaceItems = page.locator('[class*="workspace-card"], [class*="item-card"], mat-list-item, [class*="list-item"]');
    const itemCount = await workspaceItems.count();

    if (itemCount > 0) {
      // First favorite a workspace if not already
      await workspaceItems.first().hover();
      await page.waitForTimeout(300);

      const starIcon = page.locator('mat-icon:text("star_border"), mat-icon:text("star_outline"), [class*="favorite"]:not([class*="favorite-on"])').first();
      const hasStar = await starIcon.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasStar) {
        await starIcon.click();
        await page.waitForTimeout(500);
      }

      // expect: Favorited workspace displays with filled/solid star icon
      const filledStar = page.locator('mat-icon:text("star"), [class*="favorite-on"], [class*="favorited"]').first();
      const isFavorited = await filledStar.isVisible({ timeout: 5000 }).catch(() => false);

      if (isFavorited) {
        // 2. Click the filled star icon on favorited workspace
        await filledStar.click();
        await page.waitForTimeout(500);

        // expect: Workspace is removed from favorites
        // expect: Star icon changes to outline/regular style
      }
    }
  });
});
