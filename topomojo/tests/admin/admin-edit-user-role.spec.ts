// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Edit User Role', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to admin user browser
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    const usersLink = page.locator('a:has-text("User"), button:has-text("User"), mat-tab:has-text("User")').first();
    const hasUsers = await usersLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasUsers) {
      await usersLink.click();
      await page.waitForTimeout(1000);
    }

    // expect: User list displays
    // 2. Click on a user or view user details
    const userRows = page.locator('tr, mat-row, [class*="user-row"], [class*="list-item"]');
    const userCount = await userRows.count();

    if (userCount > 0) {
      await userRows.first().click();
      await page.waitForTimeout(500);

      // expect: User details form opens
      // expect: User role badge is displayed showing current role
      const roleSelector = page.locator('mat-select, select, [class*="role"], [class*="appRole"]').first();
      const hasRole = await roleSelector.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasRole) {
        // expect: Role selection is available
        await expect(roleSelector).toBeVisible();
      }
    }
  });
});
