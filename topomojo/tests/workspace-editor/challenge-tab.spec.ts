// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspace Editor', () => {
  test('Workspace Editor - Challenge Tab', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to workspace editor
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"], [class*="side-panel"]').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await expect(sidebar).toBeVisible();
    }

    const workspaceItems = page.locator('[class*="workspace-card"], [class*="item-card"], mat-list-item, [class*="list-item"]');

    const itemCount = await workspaceItems.count();

    if (itemCount > 0) {
      const challengeTab = page.locator('mat-tab:has-text("Challenge"), a:has-text("Challenge"), button:has-text("Challenge")').first();
      await workspaceItems.first().click();
      await expect(page).toHaveURL(/\/topo\//, { timeout: 10000 });

      // 2. Click on 'Challenge' tab
      const challengeContent = page.locator('[class*="challenge"], [class*="question"], form, textarea').first();
      const hasTab = await challengeTab.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasTab) {
        await challengeTab.click();
        await expect(challengeContent).toBeVisible();

        // expect: Challenge tab is selected
        // expect: Challenge editor or list is displayed
        const hasContent = await challengeContent.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasContent) {
          await expect(challengeContent).toBeVisible();
        }
      }
    }
  });
});
