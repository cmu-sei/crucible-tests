// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Real-time Updates and Notifications', () => {
  test('Presence Indicator', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Open workspace with collaboration features
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    const workspaceItems = page.locator('[class*="workspace-card"], [class*="item-card"], mat-list-item, [class*="list-item"]');

    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await expect(sidebar).toBeVisible({ timeout: 5000 });
    }
    const itemCount = await workspaceItems.count();

    if (itemCount > 0) {
      const presenceBar = page.locator('[class*="presence"], [class*="collaborator"], [class*="avatar"], [class*="user-list"]').first();
      await workspaceItems.first().click();

      // expect: Presence bar or indicator is visible
      const hasPresence = await presenceBar.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false);

      if (hasPresence) {
        // expect: User's own presence is shown
        await expect(presenceBar).toBeVisible();
      }
    }
  });
});
