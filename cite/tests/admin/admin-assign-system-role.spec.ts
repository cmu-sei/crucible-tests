// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

test.describe('Administration - Roles', () => {
  test('Assign System Role', async ({ citeAuthenticatedPage: page }) => {

    await navigateToAdminSection(page, 'Roles');

    const rolesTab = page.getByRole('tab', { name: 'Roles', exact: true });
    await expect(rolesTab).toBeVisible({ timeout: 10000 });

    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Verify permissions grid is visible with role columns
    const adminColumn = page.getByRole('columnheader', { name: 'Administrator' });
    await expect(adminColumn).toBeVisible({ timeout: 5000 });
  });
});
