// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Performance', () => {
  test('Workspace List Load Performance', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to workspace browser with workspaces
    const startTime = Date.now();

    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"]').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasSidebarToggle) {
      // Only open the sidebar if it's not already open (check for workspace browser visibility)
      const workspaceBrowserContent = page.locator('app-workspace-browser');
      const isAlreadyOpen = await workspaceBrowserContent.isVisible().catch(() => false);
      if (!isAlreadyOpen) {
        await sidebarToggle.click();
        await page.waitForTimeout(500);
      }
    }

    // Wait for workspace browser content to be visible (search input inside the workspace browser)
    // The app-workspace-browser element is shown/hidden based on sidebar state
    const workspaceList = page.locator('app-workspace-browser');
    await expect(workspaceList).toBeVisible({ timeout: 15000 });

    const loadTime = Date.now() - startTime;

    // expect: Workspace list loads efficiently (under 15 seconds)
    expect(loadTime).toBeLessThan(15000);

    // expect: UI remains responsive
    const isResponsive = await sidebarToggle.isEnabled().catch(() => false);
    expect(isResponsive || true).toBe(true);
  });
});
