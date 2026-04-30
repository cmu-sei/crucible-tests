// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('User Management in Admin', () => {
  test('View Users List', async ({ steamfitterAuthenticatedPage: page }) => {
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    await sidebar.locator('text=Users').first().click();
    await page.waitForTimeout(1000);

    const usersList = page.locator('table, mat-list, [class*="user"], [class*="list"]').first();
    await expect(usersList).toBeVisible({ timeout: 10000 });

    // Verify at least one user is displayed
    const userRows = page.locator('tr, mat-list-item, [class*="user-row"]');
    await expect(userRows.first()).toBeVisible({ timeout: 10000 });
  });
});
