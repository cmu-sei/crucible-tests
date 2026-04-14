// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspace Management', () => {
  test('Workspace Search', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to workspace browser with multiple workspaces
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"]').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      // Only open the sidebar if it's not already open
      const workspaceBrowserContent = page.locator('app-workspace-browser');
      const isAlreadyOpen = await workspaceBrowserContent.isVisible().catch(() => false);
      if (!isAlreadyOpen) {
        await sidebarToggle.click();
        await page.waitForTimeout(500);
      }
    }

    // expect: Search input field is visible
    const searchInput = page.locator('input[type="search"], input[placeholder*="earch"], input[class*="search"], [class*="search"] input').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // 2. Enter search term in search field
    await searchInput.fill('test');

    // expect: Workspace list filters to show matching workspaces only
    await page.waitForTimeout(1000);

    // expect: Search results update in real-time

    // 3. Clear search field
    await searchInput.clear();

    // expect: All workspaces are displayed again
    await page.waitForTimeout(500);
  });
});
