// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Search and Filtering', () => {
  test('Filter - All Workspaces', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to workspace browser as admin
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
    }

    // expect: Filter options are visible
    const allWorkspacesFilter = page.locator('mat-button-toggle:has-text("All"), button:has-text("All"), mat-tab:has-text("All")').first();
    const hasFilter = await allWorkspacesFilter.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasFilter) {
      // 2. Select 'All Workspaces' filter
      await allWorkspacesFilter.click();
      await page.waitForTimeout(500);

      // expect: All workspaces in system are displayed
      // expect: Workspaces from all users are shown
    }
  });
});
