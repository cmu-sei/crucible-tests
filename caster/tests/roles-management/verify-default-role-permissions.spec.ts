// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Roles and Permissions Management', () => {
  test('Verify Default Role Permissions', async ({ casterAuthenticatedPage: page }) => {

    // 1. Navigate to Roles admin section - Roles tab
    await page.goto(Services.Caster.UI + '/admin?section=Roles');

    // expect: Permissions matrix is fully displayed
    await expect(page.getByRole('columnheader', { name: 'Administrator' })).toBeVisible({ timeout: 10000 });

    // Determine column indices for each role by reading the header row
    const headerRow = page.getByRole('row').first();
    const headers = headerRow.getByRole('columnheader');
    const headerCount = await headers.count();
    let adminCol = -1, cdCol = -1, observerCol = -1;
    for (let i = 0; i < headerCount; i++) {
      const text = await headers.nth(i).innerText();
      const trimmed = text.trim().split('\n')[0].trim();
      if (trimmed === 'Administrator') adminCol = i;
      else if (trimmed === 'Content Developer') cdCol = i;
      else if (trimmed === 'Observer') observerCol = i;
    }

    // Helper: get the checkbox in a given permission row at a given column index
    const getCheckbox = (permName: string, colIndex: number) => {
      const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: permName, exact: true }) });
      return row.getByRole('cell').nth(colIndex).getByRole('checkbox');
    };

    // 2. Check Administrator role permissions
    // expect: Administrator has 'All' permission checked and disabled
    await expect(getCheckbox('All', adminCol)).toBeChecked();
    await expect(getCheckbox('All', adminCol)).toBeDisabled();

    // 3. Check Content Developer role permissions
    // expect: Content Developer has CreateProjects permission checked
    await expect(getCheckbox('CreateProjects', cdCol)).toBeChecked();

    // 4. Check Observer role permissions
    // expect: Observer has ViewProjects permission checked
    await expect(getCheckbox('ViewProjects', observerCol)).toBeChecked();

    // expect: Observer has ViewUsers permission checked
    await expect(getCheckbox('ViewUsers', observerCol)).toBeChecked();
  });
});
