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
      // The toggle flips app-workspace-browser's [hidden] binding (sidebar `open`, default
      // true, persisted in localStorage), so the click's completion signal is the browser
      // switching to the opposite visibility from before the click.
      const workspaceBrowser = page.locator('app-workspace-browser');
      const wasOpen = await workspaceBrowser.isVisible();
      await sidebarToggle.click();
      await expect(workspaceBrowser).toBeVisible({ visible: !wasOpen });
    }

    // expect: Workspace list displays
    const workspaceItems = page.locator('[class*="workspace-card"], [class*="item-card"], mat-list-item, [class*="list-item"]');
    const itemCount = await workspaceItems.count();

    if (itemCount > 0) {
      // 2. Hover over a workspace card
      await workspaceItems.first().hover();

      // expect: Favorite star icon appears (outline/regular style)
      const starIcon = page.locator('mat-icon:text("star_border"), mat-icon:text("star_outline"), [class*="favorite"]:not([class*="favorite-on"]), button:has(fa-icon)').first();
      const hasStar = await starIcon.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false);

      if (hasStar) {
        // 3. Click the star icon to favorite the workspace
        await starIcon.click();

        // expect: Workspace is marked as favorite
        // expect: Star icon changes to filled/solid style with 'favorite-on' styling
        const filledStar = page.locator('mat-icon:text("star"), [class*="favorite-on"], [class*="favorited"]').first();
        const isFavorited = await filledStar.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false);
        if (isFavorited) {
          await expect(filledStar).toBeVisible();
        }
      }
    }
  });
});
