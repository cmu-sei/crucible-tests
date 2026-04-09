// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Test: Search Users
//
// In Blueprint, the Users admin section is at /admin (SPA - URL does not change
// when navigating sidebar items). The Users table has columns: ID, Name, Role.
// Above the table there is a Search textbox that filters the list in real-time.
//
// This test:
//   1. Navigates to the admin section and clicks "Users" in the sidebar
//   2. Verifies the users table is visible with expected columns
//   3. Types "admin" in the Search input and verifies only matching rows appear
//   4. Clears the search and verifies all users return

import { test, expect, Services } from '../../fixtures';

// ---------------------------------------------------------------------------
// Helper: navigate to admin section and click a sidebar item
// ---------------------------------------------------------------------------
async function gotoAdminSection(page: any, section: string) {
  await page.goto(`${Services.Blueprint.UI}/admin`);
  await page.waitForLoadState('domcontentloaded');

  // Wait for the admin sidebar to load
  const sidebarItem = page.locator('.appitems-container mat-list-item').filter({ hasText: section }).first();
  await expect(sidebarItem).toBeVisible({ timeout: 15000 });
  await sidebarItem.click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
}

test.describe('User and Role Management', () => {
  test('Search Users', async ({ blueprintAuthenticatedPage: page }) => {
    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 10000 });

    // 2. Navigate to Users admin section
    // Blueprint is a SPA — URL stays at /admin when navigating sidebar items
    await gotoAdminSection(page, 'Users');

    // expect: Users table is visible with ID, Name, Role columns
    const usersTable = page.locator('table');
    await expect(usersTable).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole('columnheader', { name: 'ID' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('columnheader', { name: 'Role' })).toBeVisible({ timeout: 5000 });

    // 3. Count initial user rows
    const userRows = page.locator('table tbody tr');
    const initialCount = await userRows.count();
    expect(initialCount).toBeGreaterThan(0);

    // 4. Type "admin" in the Search input and press Enter to trigger the filter
    // Blueprint's search is server-side and requires pressing Enter to apply
    // expect: The list filters to show only matching users
    const searchInput = page.getByRole('textbox', { name: 'Search' });
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill('admin');
    await searchInput.press('Enter');
    await page.waitForTimeout(500);

    // expect: Filtered results are fewer than the initial count
    const filteredCount = await userRows.count();
    expect(filteredCount).toBeLessThan(initialCount);

    // expect: Each visible row contains "admin" in the Name column (case-insensitive)
    for (let i = 0; i < filteredCount; i++) {
      const rowText = await userRows.nth(i).textContent();
      expect(rowText?.toLowerCase()).toContain('admin');
    }

    // 5. Clear the search box and press Enter to restore full list
    await searchInput.clear();
    await searchInput.press('Enter');
    await page.waitForTimeout(500);

    // expect: All users are displayed again
    const clearedCount = await userRows.count();
    expect(clearedCount).toBeGreaterThan(filteredCount);
    expect(clearedCount).toBe(initialCount);
  });
});
