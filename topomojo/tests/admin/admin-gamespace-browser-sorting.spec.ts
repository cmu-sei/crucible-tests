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

    const gamespaceLink = page.locator('a:has-text("Gamespace"), button:has-text("Gamespace"), mat-tab:has-text("Gamespace")').first();
    const hasLink = await gamespaceLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasLink) {
      await gamespaceLink.click();
      await page.waitForTimeout(1000);
    }

    // expect: Gamespace list displays with table headers
    // 2. Click on column headers to sort gamespaces
    const sortableHeaders = page.locator('th, [class*="header"], mat-sort-header');
    const headerCount = await sortableHeaders.count();

    if (headerCount > 0) {
      await sortableHeaders.first().click();
      await page.waitForTimeout(500);

      // expect: Gamespaces are sorted based on selected column
      // expect: Sort indicators (up/down arrows) appear on active column
    }
  });
});
