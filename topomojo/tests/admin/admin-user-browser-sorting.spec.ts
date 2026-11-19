// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - User Browser Sortable Headers', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to admin user browser
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    // The admin browsers sort client-side in the same handler that moves the sort-up/sort-down
    // icon: only the active .sort-header button carries one, so an applied sort always changes
    // which button has the icon or its direction - even with 0 or 1 rows, where the row order
    // cannot change. Rows were already visible before the click, so they prove nothing.
    const sortState = () => page.locator('.sort-header').evaluateAll((buttons) =>
      buttons.map((b) => b.querySelector('svg[data-icon]')?.getAttribute('data-icon') ?? '').join('|'));

    const usersLink = page.locator('a:has-text("User"), button:has-text("User"), mat-tab:has-text("User")').first();
    const hasUsers = await usersLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasUsers) {
      await usersLink.click();
    }

    // expect: User list displays with table headers
    const nameHeader = page.locator('th:has-text("Name"), [class*="header"]:has-text("Name"), button:has-text("Name")').first();
    const hasNameHeader = await nameHeader.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasNameHeader) {
      // 2. Click on 'Name' column header
      let sortBefore = await sortState();
      await nameHeader.click();
      await expect.poll(sortState).not.toBe(sortBefore);

      // expect: Users are sorted by name in ascending order (A-Z)
      // expect: Sort indicator (up arrow icon) appears on Name column

      // 3. Click on 'Name' column header again
      sortBefore = await sortState();
      await nameHeader.click();
      await expect.poll(sortState).not.toBe(sortBefore);

      // expect: Users are sorted by name in descending order (Z-A)

      // 4. Click on 'Created' column header
      const createdHeader = page.locator('th:has-text("Created"), [class*="header"]:has-text("Created"), button:has-text("Created")').first();
      const hasCreated = await createdHeader.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasCreated) {
        sortBefore = await sortState();
        await createdHeader.click();
        await expect.poll(sortState).not.toBe(sortBefore);

        // expect: Users are sorted by creation date
      }
    }
  });
});
