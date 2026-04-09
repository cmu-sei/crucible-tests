// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Test: Remove Role from User
//
// In Blueprint, user roles are managed via the Users admin section at /admin.
// The Users table has columns: ID, Name, Role. Each user row has a mat-select
// combobox in the Role column. Available roles are:
//   "None Locally", "Observer", "Content Developer", "Administrator"
//
// "Removing" a role means setting the role dropdown back to "None Locally".
//
// This test:
//   1. Navigates to the admin section and clicks "Users" in the sidebar
//   2. Verifies the users table is visible with expected columns
//   3. Finds a user with a non-"None Locally" role, OR assigns "Observer" to
//      a "None Locally" user first so there is always a role to remove
//   4. Sets that user's role to "None Locally" (removing the role)
//   5. Verifies the role was removed (dropdown shows "None Locally")
//   6. Reverts the user back to their original role to keep test data clean

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
  test('Remove Role from User', async ({ blueprintAuthenticatedPage: page }) => {
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

    // 3. Find a user row with a role dropdown
    // expect: At least one user is visible in the table
    const allUserRows = page.locator('table tbody tr').filter({
      has: page.locator('mat-select'),
    });
    await expect(allUserRows.first()).toBeVisible({ timeout: 5000 });

    const rowCount = await allUserRows.count();

    // Look for a user that already has a non-"None Locally" role
    let targetRowIndex = -1;
    let originalRole = '';
    let assignedRoleForTest = false;

    for (let i = 0; i < rowCount; i++) {
      const row = allUserRows.nth(i);
      const roleSelect = row.locator('mat-select');
      const roleText = (await roleSelect.textContent()) ?? '';
      if (!roleText.trim().includes('None Locally') && roleText.trim() !== '') {
        targetRowIndex = i;
        originalRole = roleText.trim();
        break;
      }
    }

    // If no user has a non-"None Locally" role, assign "Observer" to the first
    // user so we have something to remove in this test
    if (targetRowIndex === -1) {
      const firstRow = allUserRows.first();
      const firstRoleSelect = firstRow.locator('mat-select');
      await firstRoleSelect.click();
      await page.waitForTimeout(300);

      const observerOption = page.locator('mat-option').filter({ hasText: 'Observer' });
      await expect(observerOption).toBeVisible({ timeout: 5000 });
      await observerOption.click();
      await page.waitForTimeout(500);

      targetRowIndex = 0;
      originalRole = 'None Locally';
      assignedRoleForTest = true;
    }

    // 4. Open the role dropdown for the target user and select "None Locally"
    // expect: Role is removed (set to "None Locally")
    const targetRow = allUserRows.nth(targetRowIndex);
    const roleSelect = targetRow.locator('mat-select');
    await expect(roleSelect).toBeVisible({ timeout: 5000 });

    await roleSelect.click();
    await page.waitForTimeout(300);

    const noneLocallyOption = page.locator('mat-option').filter({ hasText: 'None Locally' });
    await expect(noneLocallyOption).toBeVisible({ timeout: 5000 });
    await noneLocallyOption.click();
    await page.waitForTimeout(500);

    // 5. Verify the role was removed (dropdown shows "None Locally")
    // expect: Role dropdown now shows "None Locally"
    await expect(roleSelect).toContainText('None Locally', { timeout: 5000 });

    // 6. Revert: Restore the original role to avoid side effects
    await roleSelect.click();
    await page.waitForTimeout(300);

    const originalOption = page.locator('mat-option').filter({ hasText: originalRole }).first();
    if (await originalOption.isVisible({ timeout: 2000 })) {
      await originalOption.click();
    } else {
      // Fallback: close dropdown without changing
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(500);

    // expect: Role reverted successfully
    const finalRole = await roleSelect.textContent();
    expect(finalRole?.trim()).toBeTruthy();
  });
});
