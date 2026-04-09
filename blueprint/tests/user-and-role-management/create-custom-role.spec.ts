// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('User and Role Management', () => {
  test('Create Custom Role', async ({ blueprintAuthenticatedPage: page }) => {
    // Log in as admin user
    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 10000 });

    // 1. Navigate to Administration section via user menu dropdown
    await page.locator('button strong').click();
    await page.locator('[role="menuitem"]:has-text("Administration")').click();

    // expect: Admin page loaded (URL is /admin, sidebar is visible)
    await expect(page).toHaveURL(/.*\/admin.*/, { timeout: 10000 });
    await expect(page.locator('mat-list-item').first()).toBeVisible({ timeout: 5000 });

    // 2. Click "Roles" in the admin sidebar
    // Blueprint admin is a single-page Angular component — clicking sidebar items does NOT change URL
    await page.locator('mat-list-item').filter({ hasText: 'Roles' }).click();

    // expect: Roles permissions matrix table is visible
    // The table has a "Permissions" column header and role columns (Administrator, Content Developer, Observer, etc.)
    const rolesTable = page.locator('table');
    await expect(rolesTable).toBeVisible({ timeout: 5000 });

    // Verify the "Permissions" column header is present (key indicator of roles matrix)
    await expect(page.locator('[role="columnheader"]:has-text("Permissions")')).toBeVisible({ timeout: 5000 });

    // Verify known system roles are displayed as column headers
    await expect(page.locator('[role="columnheader"]:has-text("Administrator")')).toBeVisible({ timeout: 5000 });

    // 3. Create a new custom role
    // Click the "+" (Add Role) button inside the "Permissions" column header
    const addRoleButton = page.locator('[role="columnheader"]:has-text("Permissions") button').first();
    await addRoleButton.click();

    // expect: A "Role name" text input appears inline in the column header
    const roleNameInput = page.locator('input[placeholder="Role name"], input[aria-label="Role name"]');
    await expect(roleNameInput).toBeVisible({ timeout: 5000 });

    // 4. Enter the new role name
    const customRoleName = `TestRole_${Date.now()}`;
    await roleNameInput.fill(customRoleName);

    // 5. Save the new role by clicking the checkmark (save) button
    // The save button is the first button inside the column header that contains the role name input
    const saveButton = page.locator('[role="columnheader"]:has(input[placeholder="Role name"]) button').first();
    await saveButton.click();

    // expect: The new role appears as a column header in the permissions matrix
    await expect(page.locator(`[role="columnheader"]:has-text("${customRoleName}")`)).toBeVisible({ timeout: 5000 });

    // 6. Clean up: Delete the test role
    // Click the delete button (second button) in the new role's column header
    const newRoleHeader = page.locator(`[role="columnheader"]:has-text("${customRoleName}")`);
    const deleteButton = newRoleHeader.locator('button').nth(1);
    await deleteButton.click();

    // expect: A confirmation dialog appears
    const confirmDialog = page.locator('[role="dialog"]:has-text("Delete Role")');
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });
    await expect(confirmDialog).toContainText(customRoleName);

    // 7. Confirm deletion
    await confirmDialog.locator('button:has-text("YES")').click();

    // expect: The role is removed from the permissions matrix
    await expect(page.locator(`[role="columnheader"]:has-text("${customRoleName}")`)).not.toBeVisible({ timeout: 5000 });
  });
});
