// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { seedSystemRole, getSystemRoles, deleteSystemRolesByPrefix } from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

/**
 * Toggling a permission checkbox in the System Roles grid PUTs the role with its updated
 * permission set. The grid is transposed (permission rows, role columns), so this spec
 * seeds a custom (mutable) role, finds its column, toggles the "All" permission in that
 * column, waits on the PUT, and confirms via the API that the role now holds all
 * permissions.
 */
test.describe('Role Management in Admin', () => {
  const ROLE_NAME = `E2E Perm Role ${Date.now()}`;
  let roleId: string;

  test.beforeEach(async () => {
    roleId = await seedSystemRole(ROLE_NAME);
  });

  test.afterEach(async () => {
    await deleteSystemRolesByPrefix(['E2E Perm Role']);
  });

  test('Edit system role permissions', async ({ steamfitterAuthenticatedPage: page }) => {
    await navigateToAdminSection(page, 'Roles');

    const rolesTab = page.getByRole('tab', { name: 'Roles', exact: true });
    await rolesTab.click();
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Resolve the seeded role's column index from the header row.
    const headerCells = page.locator('thead tr').first().locator('th');
    await expect(page.getByRole('columnheader', { name: ROLE_NAME })).toBeVisible({
      timeout: 10000,
    });
    const headerTexts = await headerCells.allInnerTexts();
    const columnIndex = headerTexts.findIndex((t) => t.includes(ROLE_NAME));
    expect(columnIndex, 'seeded role column should be found').toBeGreaterThan(0);

    // The first body row is the "All" permission row; toggle this role's cell in it.
    const allRow = page
      .locator('tbody tr')
      .filter({ has: page.getByRole('cell', { name: 'All', exact: true }) })
      .first();
    const checkbox = allRow.locator('td').nth(columnIndex).getByRole('checkbox');

    const putResponse = page.waitForResponse(
      (response) =>
        /\/api\/system-roles\//.test(response.url()) &&
        response.request().method() === 'PUT' &&
        response.ok(),
      { timeout: 15000 }
    );
    await checkbox.click();
    await putResponse;

    // Confirm the change persisted: the role now holds all permissions.
    const roles = await getSystemRoles();
    const updated = roles.find((r) => r.id === roleId);
    expect(updated, 'seeded role should still exist').toBeTruthy();
    expect(updated!.allPermissions, 'role should now hold all permissions').toBe(true);
  });
});
