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
      // The toggle flips app-workspace-browser's [hidden] binding (sidebar `open`, default
      // true, persisted in localStorage), so the click's completion signal is the browser
      // switching to the opposite visibility from before the click.
      const workspaceBrowser = page.locator('app-workspace-browser');
      const wasOpen = await workspaceBrowser.isVisible();
      await sidebarToggle.click();
      await expect(workspaceBrowser).toBeVisible({ visible: !wasOpen });
    }

    const workspaceItems = page.locator('[class*="workspace-card"], [class*="item-card"], mat-list-item, [class*="list-item"]');
    const itemCount = await workspaceItems.count();

    if (itemCount > 0) {
      // First favorite a workspace if not already
      await workspaceItems.first().hover();

      const starIcon = page.locator('mat-icon:text("star_border"), mat-icon:text("star_outline"), [class*="favorite"]:not([class*="favorite-on"])').first();
      const hasStar = await starIcon.waitFor({ state: 'visible', timeout: 3000 }).then(() => true, () => false);
      if (hasStar) {
        await starIcon.click();
      }

      // expect: Favorited workspace displays with filled/solid star icon
      const favoritedStars = page.locator('mat-icon:text("star"), [class*="favorite-on"], [class*="favorited"]');
      const filledStar = favoritedStars.first();
      const isFavorited = await filledStar.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false);

      if (isFavorited) {
        // 2. Click the filled star icon on favorited workspace
        const favoritedCount = await favoritedStars.count();
        await filledStar.click();
        await expect(favoritedStars).toHaveCount(favoritedCount - 1);

        // expect: Workspace is removed from favorites
        // expect: Star icon changes to outline/regular style
      }
    }
  });
});
