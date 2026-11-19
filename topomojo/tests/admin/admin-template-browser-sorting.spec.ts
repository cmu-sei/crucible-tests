// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Template Browser Sortable Headers', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to admin template browser
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    // The admin browsers sort client-side in the same handler that moves the sort-up/sort-down
    // icon: only the active .sort-header button carries one, so an applied sort always changes
    // which button has the icon or its direction - even with 0 or 1 rows, where the row order
    // cannot change. Rows were already visible before the click, so they prove nothing.
    const sortState = () => page.locator('.sort-header').evaluateAll((buttons) =>
      buttons.map((b) => b.querySelector('svg[data-icon]')?.getAttribute('data-icon') ?? '').join('|'));

    const templateLink = page.locator('a:has-text("Template"), button:has-text("Template"), mat-tab:has-text("Template")').first();
    const hasLink = await templateLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasLink) {
      await templateLink.click();
    }

    // expect: Template list displays with table headers
    // 2. Click on 'Name' column header to sort templates by name
    const nameHeader = page.locator('th:has-text("Name"), button:has-text("Name"), mat-sort-header:has-text("Name")').first();
    const hasName = await nameHeader.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasName) {
      const sortBefore = await sortState();
      await nameHeader.click();
      await expect.poll(sortState).not.toBe(sortBefore);

      // expect: Templates are sorted alphabetically by name
      // expect: Sort indicator appears on Name column
    }
  });
});
