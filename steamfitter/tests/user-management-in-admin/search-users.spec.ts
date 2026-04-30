// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('User Management in Admin', () => {
  test('Search Users', async ({ steamfitterAuthenticatedPage: page }) => {
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    await sidebar.locator('text=Users').first().click();
    await page.waitForTimeout(1000);

    // Search for 'admin'
    const searchInput = page.locator('input[placeholder*="earch"], input[placeholder*="ilter"], input[type="search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('admin');
    await page.waitForTimeout(1000);

    // Verify filtered results contain admin user
    await expect(page.locator('text=admin').first()).toBeVisible({ timeout: 10000 });

    // Clear search and verify all users return
    await searchInput.clear();
    await page.waitForTimeout(1000);

    const userRows = page.locator('tr, mat-list-item, [class*="user-row"]');
    const count = await userRows.count();
    expect(count).toBeGreaterThan(0);
  });
});
