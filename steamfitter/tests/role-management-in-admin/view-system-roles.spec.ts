// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

/**
 * The admin Roles section is a `mat-tab-group`; its first tab ("Roles") holds the
 * editable System Roles grid (a transposed table: permission rows, role columns). This
 * spec opens the section, confirms the Roles tab and grid render, and that a built-in
 * role column ("Administrator") is present.
 */
test.describe('Role Management in Admin', () => {
  test('View system roles', async ({ steamfitterAuthenticatedPage: page }) => {
    await navigateToAdminSection(page, 'Roles');

    const rolesTab = page.getByRole('tab', { name: 'Roles', exact: true });
    await expect(rolesTab).toBeVisible({ timeout: 10000 });
    await rolesTab.click();

    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // The built-in Administrator role is always a column in the grid.
    await expect(
      page.getByRole('columnheader', { name: 'Administrator' })
    ).toBeVisible({ timeout: 10000 });
  });
});
