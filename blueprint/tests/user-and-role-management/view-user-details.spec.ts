// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Test: View Users List
//
// In Blueprint, there is no separate "user detail page". User information is
// displayed inline in the Users admin table at /admin (URL stays at /admin).
// The Users table has columns: ID, Name, Role.
// Each row has a mat-select combobox in the Role column for inline role assignment.
//
// This test:
//   1. Navigates to the admin section and clicks "Users" in the sidebar
//   2. Verifies the users table is visible with expected columns (ID, Name, Role)
//   3. Verifies at least one user row is visible with data in each column
//   4. Opens a role dropdown to confirm role options are visible (without changing anything)

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
  test('View User Details', async ({ blueprintAuthenticatedPage: page }) => {
    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 10000 });

    // 2. Navigate to Users admin section
    // Note: URL stays at /admin — there is no /admin/users route
    await gotoAdminSection(page, 'Users');

    // expect: Users table is visible with ID, Name, Role columns
    const usersTable = page.locator('table');
    await expect(usersTable).toBeVisible({ timeout: 10000 });

    // expect: Table has expected column headers
    await expect(page.getByRole('columnheader', { name: 'ID' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('columnheader', { name: 'Role' })).toBeVisible({ timeout: 5000 });

    // 3. Verify at least one user row is present with data
    // expect: At least one user row is visible in the table
    const userRows = page.locator('table tbody tr');
    await expect(userRows.first()).toBeVisible({ timeout: 5000 });

    // expect: Each visible row has content in the ID and Name columns
    const firstRow = userRows.first();
    const idCell = firstRow.locator('td').nth(0);
    const nameCell = firstRow.locator('td').nth(1);
    const roleCell = firstRow.locator('td').nth(2);

    await expect(idCell).not.toBeEmpty({ timeout: 5000 });
    await expect(nameCell).not.toBeEmpty({ timeout: 5000 });
    await expect(roleCell).toBeVisible({ timeout: 5000 });

    // expect: Role column contains a mat-select dropdown
    const roleSelect = firstRow.locator('mat-select');
    await expect(roleSelect).toBeVisible({ timeout: 5000 });

    // 4. Open the role dropdown to verify role options are visible
    // (Read-only check — no role change)
    await roleSelect.click();
    await page.waitForTimeout(300);

    // expect: Role dropdown shows available options
    const roleOptions = page.locator('mat-option');
    await expect(roleOptions.first()).toBeVisible({ timeout: 5000 });

    // expect: Known role options are present
    await expect(page.locator('mat-option').filter({ hasText: 'None Locally' })).toBeVisible({ timeout: 3000 });
    await expect(page.locator('mat-option').filter({ hasText: 'Observer' })).toBeVisible({ timeout: 3000 });
    await expect(page.locator('mat-option').filter({ hasText: 'Content Developer' })).toBeVisible({ timeout: 3000 });
    await expect(page.locator('mat-option').filter({ hasText: 'Administrator' })).toBeVisible({ timeout: 3000 });

    // Close the dropdown without making changes (press Escape)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  });
});
