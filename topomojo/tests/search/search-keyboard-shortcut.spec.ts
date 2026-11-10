// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, serviceUrlPattern, waitForFirstVisible } from '../../fixtures';

test.describe('Search and Filtering', () => {
  test('Search - Keyboard Shortcut', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to home page - handled by fixture
    // expect: Home page is displayed
    await expect(page).toHaveURL(serviceUrlPattern(Services.TopoMojo.UI));

    // 2. Press Ctrl+O keyboard shortcut
    const searchInput = page.locator('input[type="search"], input[placeholder*="earch"], input:focus').first();
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();

    await page.keyboard.press('Control+o');

    // expect: Search field is focused or sidebar opens
    const winner = await waitForFirstVisible(page, [
      { key: 'search', locator: searchInput },
      { key: 'sidebar', locator: sidebar }
    ], { timeout: 3000 });
    expect(winner).not.toBeNull();
  });
});
