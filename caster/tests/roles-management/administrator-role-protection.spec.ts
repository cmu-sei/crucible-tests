// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Roles and Permissions Management', () => {
  test('Administrator Role Protection', async ({ casterAuthenticatedPage: page }) => {

    // 1. Navigate to Roles admin section
    await page.goto(Services.Caster.UI + '/admin?section=Roles');

    // expect: Roles matrix is visible
    await expect(page.getByRole('columnheader', { name: 'Administrator' })).toBeVisible({ timeout: 10000 });

    // 2. Check Administrator role header for rename icon
    const adminHeader = page.getByRole('columnheader', { name: 'Administrator' });

    // expect: Rename icon is not present for Administrator role
    await expect(adminHeader.getByRole('button', { name: 'Rename Role' })).not.toBeVisible();

    // 3. Check Administrator role header for delete icon
    // expect: Delete icon is not present for Administrator role
    await expect(adminHeader.getByRole('button', { name: 'Delete Role' })).not.toBeVisible();

    // 4. Check Administrator All permission checkbox
    // expect: All permission is checked and disabled for Administrator
    const allRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'All', exact: true }) });
    const adminAllCheckbox = allRow.getByRole('checkbox').first();
    await expect(adminAllCheckbox).toBeChecked();
    await expect(adminAllCheckbox).toBeDisabled();
  });
});
