// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Gamespace Browser Sortable Headers', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to admin gamespace browser
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    // The admin browsers sort client-side in the same handler that moves the sort-up/sort-down
    // icon: only the active .sort-header button carries one, so an applied sort always changes
    // which button has the icon or its direction - even with 0 or 1 rows, where the row order
    // cannot change. Rows were already visible before the click, so they prove nothing.
    const sortState = () => page.locator('.sort-header').evaluateAll((buttons) =>
      buttons.map((b) => b.querySelector('svg[data-icon]')?.getAttribute('data-icon') ?? '').join('|'));

    const gamespaceLink = page.locator('a:has-text("Gamespace"), button:has-text("Gamespace"), mat-tab:has-text("Gamespace")').first();
    const hasLink = await gamespaceLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasLink) {
      await gamespaceLink.click();

      // expect: Gamespace list displays with table headers
      // 2. Click on column headers to sort gamespaces
      const sortableHeaders = page.locator('th, [class*="header"], mat-sort-header');
      await expect(sortableHeaders.first()).toBeVisible();
    }

    const sortableHeaders = page.locator('th, [class*="header"], mat-sort-header');
    const headerCount = await sortableHeaders.count();

    if (headerCount > 0) {
      const sortBefore = await sortState();
      await sortableHeaders.first().click();
      await expect.poll(sortState).not.toBe(sortBefore);

      // expect: Gamespaces are sorted based on selected column
      // expect: Sort indicators (up/down arrows) appear on active column
    }
  });
});
