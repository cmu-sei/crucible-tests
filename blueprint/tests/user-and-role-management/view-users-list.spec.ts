// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Test: View Users List
//
// In Blueprint, there is no separate /admin/users route. User management lives
// at /admin (URL stays at /admin) after clicking "Users" in the sidebar.
// The Users table has columns: ID, Name, Role.
// Each row has a mat-select combobox in the Role column for inline role assignment.
//
// This test:
//   1. Navigates to the admin section and clicks "Users" in the sidebar
//   2. Verifies the users table is visible
//   3. Verifies column headers (ID, Name, Role) are present
//   4. Verifies at least one user row exists with non-empty content
//   5. Checks whether pagination controls are present (low user count means they likely won't be)

import { test, expect, Services } from '../../fixtures';

test.describe('User and Role Management', () => {
  test('View Users List', async ({ blueprintAuthenticatedPage: page }) => {
    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 10000 });

    // 2. Navigate to the admin section
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // 3. Click "Users" in the admin sidebar
    // Note: URL stays at /admin — there is no /admin/users route
    const usersItem = page.locator('.appitems-container mat-list-item').filter({ hasText: 'Users' }).first();
    await expect(usersItem).toBeVisible({ timeout: 15000 });
    await usersItem.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // expect: URL remains at /admin
    await expect(page).toHaveURL(/.*\/admin.*/, { timeout: 5000 });

    // expect: Users table is visible
    const usersTable = page.locator('table');
    await expect(usersTable).toBeVisible({ timeout: 10000 });

    // expect: Table has expected column headers — ID, Name, Role
    await expect(page.getByRole('columnheader', { name: 'ID' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('columnheader', { name: 'Role' })).toBeVisible({ timeout: 5000 });

    // expect: At least one user row is visible with non-empty content
    const userRows = page.locator('table tbody tr');
    await expect(userRows.first()).toBeVisible({ timeout: 5000 });

    const firstRow = userRows.first();
    const idCell = firstRow.locator('td').nth(0);
    const nameCell = firstRow.locator('td').nth(1);

    await expect(idCell).not.toBeEmpty({ timeout: 5000 });
    await expect(nameCell).not.toBeEmpty({ timeout: 5000 });

    // expect: Pagination is not required (low user count), but if present it should be visible
    const paginationExists = await page.locator('mat-paginator').isVisible({ timeout: 2000 }).catch(() => false);
    if (paginationExists) {
      await expect(page.locator('mat-paginator')).toBeVisible();
    }
  });
});
