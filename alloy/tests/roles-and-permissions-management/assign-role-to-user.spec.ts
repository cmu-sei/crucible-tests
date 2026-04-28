// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Roles and Permissions Management', () => {
  test('Assign Role to User', async ({ page }) => {
    // 1. Navigate to admin Users section
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    await page.locator('mat-list-item').filter({ hasText: 'Users' }).click();

    // expect: Users list is visible
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Admin User' })).toBeVisible();

    // 2. Verify role assignment dropdown is available for users
    // Each user row has a role combobox
    await expect(page.getByRole('columnheader', { name: 'Role' })).toBeVisible();

    // The role combobox is visible in the user row
    const roleCombobox = page.getByRole('combobox', { name: 'None Locally' }).first();
    await expect(roleCombobox).toBeVisible();
  });
});
