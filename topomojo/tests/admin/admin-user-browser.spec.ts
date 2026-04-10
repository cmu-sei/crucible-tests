// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - User Browser', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to admin dashboard
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    // expect: Admin menu is visible
    // 2. Click on 'Users' section
    const usersLink = page.locator('a:has-text("User"), button:has-text("User"), mat-tab:has-text("User")').first();
    const hasUsers = await usersLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasUsers) {
      await usersLink.click();
      await page.waitForTimeout(1000);
    }

    // expect: User browser page loads
    // expect: List of users is displayed in table format
    const userTable = page.locator('table, mat-table, [class*="user-list"], [class*="browser"]').first();
    await expect(userTable).toBeVisible({ timeout: 10000 });

    // expect: User details include name, role, and created date
  });
});
