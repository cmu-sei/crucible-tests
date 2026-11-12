// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspace Management', () => {
  test('Navigate to Workspace Editor', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to workspace list
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
      // 2. Click on a workspace card or 'Settings' link when hovering
      await workspaceItems.first().hover();

      const settingsLink = page.locator('a:has-text("Settings"), button:has-text("Settings"), a[href*="/topo/"]').first();
      const hasSettings = await settingsLink.waitFor({ state: 'visible', timeout: 3000 }).then(() => true, () => false);

      if (hasSettings) {
        await settingsLink.click();
      } else {
        await workspaceItems.first().click();
      }

      // expect: User is navigated to workspace editor page
      // expect: URL changes to /topo/:id format
      await expect(page).toHaveURL(/\/topo\//, { timeout: 10000 });

      // expect: Workspace editor interface loads
      await page.waitForLoadState('domcontentloaded');
    }
  });
});
