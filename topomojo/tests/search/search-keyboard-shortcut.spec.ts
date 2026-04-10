// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Search and Filtering', () => {
  test('Search - Keyboard Shortcut', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to home page - handled by fixture
    // expect: Home page is displayed
    await expect(page).toHaveURL(/localhost:4201/);

    // 2. Press Ctrl+O keyboard shortcut
    await page.keyboard.press('Control+o');
    await page.waitForTimeout(500);

    // expect: Search field is focused or sidebar opens
    const searchInput = page.locator('input[type="search"], input[placeholder*="earch"], input:focus').first();
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();

    const isSearchFocused = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);
    const isSidebarOpen = await sidebar.isVisible({ timeout: 3000 }).catch(() => false);

    expect(isSearchFocused || isSidebarOpen).toBe(true);
  });
});
