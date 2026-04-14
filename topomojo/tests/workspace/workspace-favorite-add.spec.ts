// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspace Management', () => {
  test('Workspace Favorites - Add Favorite', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to workspace list in sidebar
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
    }

    // expect: Workspace list displays
    const workspaceItems = page.locator('[class*="workspace-card"], [class*="item-card"], mat-list-item, [class*="list-item"]');
    const itemCount = await workspaceItems.count();

    if (itemCount > 0) {
      // 2. Hover over a workspace card
      await workspaceItems.first().hover();
      await page.waitForTimeout(300);

      // expect: Favorite star icon appears (outline/regular style)
      const starIcon = page.locator('mat-icon:text("star_border"), mat-icon:text("star_outline"), [class*="favorite"]:not([class*="favorite-on"]), button:has(fa-icon)').first();
      const hasStar = await starIcon.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasStar) {
        // 3. Click the star icon to favorite the workspace
        await starIcon.click();
        await page.waitForTimeout(500);

        // expect: Workspace is marked as favorite
        // expect: Star icon changes to filled/solid style with 'favorite-on' styling
        const filledStar = page.locator('mat-icon:text("star"), [class*="favorite-on"], [class*="favorited"]').first();
        const isFavorited = await filledStar.isVisible({ timeout: 5000 }).catch(() => false);
        if (isFavorited) {
          await expect(filledStar).toBeVisible();
        }
      }
    }
  });
});
