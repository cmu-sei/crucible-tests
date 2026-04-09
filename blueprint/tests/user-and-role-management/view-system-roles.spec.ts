// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('User and Role Management', () => {
  test('View System Roles', async ({ blueprintAuthenticatedPage: page }) => {
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

    // expect: "Permissions" column header is present (key indicator of roles matrix)
    await expect(page.locator('[role="columnheader"]:has-text("Permissions")')).toBeVisible({ timeout: 5000 });

    // expect: 3 built-in roles are shown as column headers
    await expect(page.locator('[role="columnheader"]:has-text("Administrator")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[role="columnheader"]:has-text("Content Developer")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[role="columnheader"]:has-text("Observer")')).toBeVisible({ timeout: 5000 });

    // expect: Permissions rows are visible in the matrix
    const permissionRows = page.locator('[role="row"]');
    await expect(permissionRows.first()).toBeVisible({ timeout: 5000 });
    const rowCount = await permissionRows.count();
    expect(rowCount).toBeGreaterThan(1);
  });
});
