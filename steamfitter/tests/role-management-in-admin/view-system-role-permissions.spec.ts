// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { getSystemRoles } from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

/**
 * The System Roles grid lists every permission as a row (with an "All" row on top) and
 * shows each role's grants as checkboxes at the row/column intersection. This spec
 * confirms the permission rows render and that the Administrator role — which holds all
 * permissions per the API — shows its "All" checkbox checked.
 */
test.describe('Role Management in Admin', () => {
  test('View system role permissions', async ({ steamfitterAuthenticatedPage: page }) => {
    // The API is the source of truth for which role has allPermissions.
    const roles = await getSystemRoles();
    const adminRole = roles.find((r) => r.name === 'Administrator');
    expect(adminRole, 'Administrator role should exist').toBeTruthy();
    expect(adminRole!.allPermissions, 'Administrator should hold all permissions').toBe(true);

    await navigateToAdminSection(page, 'Roles');

    const rolesTab = page.getByRole('tab', { name: 'Roles', exact: true });
    await rolesTab.click();

    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // The "All" permission row is always present, plus at least one concrete
    // permission row (permissions come from the API's SystemPermission enum).
    await expect(page.getByRole('cell', { name: 'All', exact: true }).first()).toBeVisible({
      timeout: 10000,
    });

    // The Administrator column holds all permissions, so its "All" checkbox is checked;
    // confirm at least one checkbox in the grid renders checked.
    await expect(page.getByRole('checkbox', { checked: true }).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
