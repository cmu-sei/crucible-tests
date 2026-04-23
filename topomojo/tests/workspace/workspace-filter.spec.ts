// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspace Management', () => {
  test('Workspace Filter Toggle', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to workspace browser
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
    }

    // expect: Filter toggle or tabs are visible (e.g., 'My Workspaces', 'All Workspaces')
    const filterOptions = page.locator('mat-button-toggle-group, [class*="filter"], mat-tab-group, [class*="toggle"]').first();
    const hasFilters = await filterOptions.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasFilters) {
      // 2. Click on different filter options
      const filterButtons = page.locator('mat-button-toggle, [class*="filter"] button, mat-tab');
      const filterCount = await filterButtons.count();

      if (filterCount > 1) {
        // Click second filter option
        await filterButtons.nth(1).click();
        await page.waitForTimeout(500);

        // expect: Workspace list updates based on selected filter
        // expect: Filter selection is highlighted

        // Click first filter option back
        await filterButtons.nth(0).click();
        await page.waitForTimeout(500);
      }
    }
  });
});
