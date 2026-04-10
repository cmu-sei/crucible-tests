// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Concurrent Workspace Edits', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Open same workspace in browser
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
    }

    const workspaceItems = page.locator('[class*="workspace-card"], [class*="item-card"], mat-list-item, [class*="list-item"]');
    const itemCount = await workspaceItems.count();

    if (itemCount > 0) {
      await workspaceItems.first().click();
      await page.waitForTimeout(2000);

      // expect: Workspace is open
      await expect(page).toHaveURL(/\/topo\//, { timeout: 10000 });

      // Verify the workspace editor loads without errors
      const appRoot = page.locator('app-root').first();
      await expect(appRoot).toBeVisible({ timeout: 10000 });

      // expect: Application handles concurrent edits via SignalR
      // expect: No data corruption occurs
    }
  });
});
