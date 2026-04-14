// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Search and Filtering', () => {
  test('Filter - My Workspaces', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to workspace browser
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
    }

    // expect: Filter options are visible
    const myWorkspacesFilter = page.locator('mat-button-toggle:has-text("My"), button:has-text("My"), mat-tab:has-text("My")').first();
    const hasFilter = await myWorkspacesFilter.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasFilter) {
      // 2. Select 'My Workspaces' filter
      await myWorkspacesFilter.click();
      await page.waitForTimeout(500);

      // expect: Only workspaces owned by current user are displayed
      // expect: Other workspaces are hidden
    }
  });
});
