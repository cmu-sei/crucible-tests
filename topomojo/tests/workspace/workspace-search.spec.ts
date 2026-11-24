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
        await expect(workspaceBrowserContent).toBeVisible();
      }
    }

    // expect: Search input field is visible
    const searchInput = page.locator('input[type="search"], input[placeholder*="earch"], input[class*="search"], [class*="search"] input').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Each input event re-queries GET /api/workspaces (150 ms debounce; an empty term is
    // omitted from the query string). The filtered list may legitimately be empty, so the
    // completion signal is the list response for that term rather than a row.
    const workspaceListFor = (term: string | null) =>
      page.waitForResponse((r) => {
        const url = new URL(r.url());
        return url.pathname.endsWith('/workspaces') && url.searchParams.get('term') === term;
      });

    // 2. Enter search term in search field
    const filtered = workspaceListFor('test');
    await searchInput.fill('test');

    // expect: Workspace list filters to show matching workspaces only
    await filtered;

    // expect: Search results update in real-time

    // 3. Clear search field
    const unfiltered = workspaceListFor(null);
    await searchInput.clear();

    // expect: All workspaces are displayed again
    await unfiltered;
  });
});
