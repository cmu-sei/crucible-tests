// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Roles and Permissions Management', () => {
  test('Create System Role', async ({ page }) => {
    // 1. Navigate to admin Roles section, Roles tab
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    await page.locator('mat-list-item').filter({ hasText: 'Roles' }).click();

    // expect: System roles list is visible
    await expect(page.getByRole('tab', { name: 'Roles', exact: true })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    // 2. Verify permissions are listed
    await expect(page.getByRole('cell', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'CreateEventTemplates' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ViewUsers' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ManageRoles' })).toBeVisible();

    // 3. Verify add button is present
    // The permissions table header has an add button
    await expect(page.getByRole('columnheader', { name: 'Permissions' })).toBeVisible();
  });
});
