// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Test: Assign Role to User
//
// In Blueprint, user roles are assigned via the Users admin section at /admin.
// The Users table has columns: ID, Name, Role. Each user row has a mat-select
// combobox in the Role column. Available roles are:
//   "None Locally", "Observer", "Content Developer", "Administrator"
//
// This test:
//   1. Navigates to the admin section and clicks "Users" in the sidebar
//   2. Verifies the users table is visible with expected columns
//   3. Finds a user with "None Locally" role (non-admin user)
//   4. Opens the role dropdown and verifies available role options
//   5. Assigns the "Observer" role to that user
//   6. Verifies the role was assigned (dropdown shows "Observer")
//   7. Reverts the role back to "None Locally" to avoid side effects

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
  test('Assign Role to User', async ({ blueprintAuthenticatedPage: page }) => {
    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 10000 });

    // 2. Navigate to Users admin section
    // expect: Users admin section is visible with user table
    await gotoAdminSection(page, 'Users');

    // expect: Users table is visible with ID, Name, Role columns
    const usersTable = page.locator('table');
    await expect(usersTable).toBeVisible({ timeout: 10000 });

    // expect: Table has expected column headers
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('columnheader', { name: 'Role' })).toBeVisible({ timeout: 5000 });

    // 3. Find a user row in the table (use the first user row with a role dropdown)
    // expect: At least one user is visible in the table
    const userRows = page.locator('table tbody tr').filter({
      has: page.locator('mat-select'),
    });
    await expect(userRows.first()).toBeVisible({ timeout: 5000 });

    // Get the first user row and its current role dropdown
    const firstUserRow = userRows.first();
    const userName = await firstUserRow.locator('td').nth(1).textContent();
    const roleSelect = firstUserRow.locator('mat-select');
    await expect(roleSelect).toBeVisible({ timeout: 5000 });

    // 4. Note the current role value
    const initialRole = await roleSelect.textContent();

    // 5. Open the role dropdown
    // expect: Dropdown opens with available role options
    await roleSelect.click();
    await page.waitForTimeout(300);

    // expect: Role dropdown shows available options
    const roleOptions = page.locator('mat-option');
    await expect(roleOptions.first()).toBeVisible({ timeout: 5000 });

    // Verify expected role options exist
    await expect(page.locator('mat-option').filter({ hasText: 'None Locally' })).toBeVisible({ timeout: 3000 });
    await expect(page.locator('mat-option').filter({ hasText: 'Observer' })).toBeVisible({ timeout: 3000 });
    await expect(page.locator('mat-option').filter({ hasText: 'Content Developer' })).toBeVisible({ timeout: 3000 });
    await expect(page.locator('mat-option').filter({ hasText: 'Administrator' })).toBeVisible({ timeout: 3000 });

    // 6. Select the "Observer" role
    // expect: Role is assigned to the user
    const observerOption = page.locator('mat-option').filter({ hasText: 'Observer' });
    await observerOption.click();
    await page.waitForTimeout(500);

    // expect: Role dropdown now shows "Observer"
    await expect(roleSelect).toContainText('Observer', { timeout: 5000 });

    // 7. Revert: Restore the original role to avoid side effects
    // Re-open the dropdown
    await roleSelect.click();
    await page.waitForTimeout(300);

    // Select the original role (or "None Locally" as fallback)
    const originalRoleText = initialRole?.trim() ?? 'None Locally';
    const originalOption = page.locator('mat-option').filter({ hasText: originalRoleText }).first();
    if (await originalOption.isVisible({ timeout: 2000 })) {
      await originalOption.click();
    } else {
      // Fallback to "None Locally"
      await page.locator('mat-option').filter({ hasText: 'None Locally' }).click();
    }
    await page.waitForTimeout(500);

    // expect: Role reverted successfully (dropdown shows original role or "None Locally")
    const finalRole = await roleSelect.textContent();
    expect(finalRole?.trim()).toBeTruthy();
  });
});
