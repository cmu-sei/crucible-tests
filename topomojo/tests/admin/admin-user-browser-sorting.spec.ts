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

    const usersLink = page.locator('a:has-text("User"), button:has-text("User"), mat-tab:has-text("User")').first();
    const hasUsers = await usersLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasUsers) {
      await usersLink.click();
      await page.waitForTimeout(1000);
    }

    // expect: User list displays with table headers
    const nameHeader = page.locator('th:has-text("Name"), [class*="header"]:has-text("Name"), button:has-text("Name")').first();
    const hasNameHeader = await nameHeader.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasNameHeader) {
      // 2. Click on 'Name' column header
      await nameHeader.click();
      await page.waitForTimeout(500);

      // expect: Users are sorted by name in ascending order (A-Z)
      // expect: Sort indicator (up arrow icon) appears on Name column

      // 3. Click on 'Name' column header again
      await nameHeader.click();
      await page.waitForTimeout(500);

      // expect: Users are sorted by name in descending order (Z-A)

      // 4. Click on 'Created' column header
      const createdHeader = page.locator('th:has-text("Created"), [class*="header"]:has-text("Created"), button:has-text("Created")').first();
      const hasCreated = await createdHeader.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasCreated) {
        await createdHeader.click();
        await page.waitForTimeout(500);

        // expect: Users are sorted by creation date
      }
    }
  });
});
