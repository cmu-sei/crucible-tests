// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Users Management', () => {
  test('View User Details', async ({ page }) => {
    // 1. Navigate to admin Users section
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    await page.locator('mat-list-item').filter({ hasText: 'Users' }).click();

    // expect: Users list is visible
    await expect(page.getByRole('table')).toBeVisible();

    // 2. Verify user details are visible
    // expect: User information is shown: ID, name, role
    await expect(page.getByRole('cell', { name: 'Admin User' })).toBeVisible();

    // expect: Role column shows role assignment
    await expect(page.getByRole('columnheader', { name: 'Role' })).toBeVisible();

    // expect: User ID is displayed
    await expect(page.getByRole('columnheader', { name: 'ID' })).toBeVisible();
  });
});
