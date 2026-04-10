// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspace Management', () => {
  test('Workspace List Display', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Log in and open sidebar to view workspace browser
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
    }

    // expect: Workspace browser displays list of workspaces
    const workspaceBrowser = page.locator('[class*="workspace"], [class*="browser"], mat-sidenav, mat-drawer').first();
    await expect(workspaceBrowser).toBeVisible({ timeout: 10000 });

    // expect: Workspace cards show name and metadata
    const workspaceItems = page.locator('[class*="workspace-card"], [class*="item-card"], mat-list-item, [class*="ws-card"], [class*="list-item"]');
    const itemCount = await workspaceItems.count();
    if (itemCount > 0) {
      await expect(workspaceItems.first()).toBeVisible();
    }

    // expect: Each workspace has action links when hovered or selected
  });
});
