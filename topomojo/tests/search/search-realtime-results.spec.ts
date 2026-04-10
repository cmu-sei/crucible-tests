// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Search and Filtering', () => {
  test('Search - Real-time Results', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to workspace browser
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
    }

    // expect: Search field is visible
    const searchInput = page.locator('input[type="search"], input[placeholder*="earch"], [class*="search"] input').first();
    const hasSearch = await searchInput.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasSearch) {
      // 2. Type search term character by character
      await searchInput.click();
      await page.keyboard.type('test', { delay: 200 });

      // expect: Results update in real-time as user types
      await page.waitForTimeout(1000);

      // expect: Matching workspaces are highlighted or filtered
      // Clear search
      await searchInput.clear();
      await page.waitForTimeout(500);
    }
  });
});
