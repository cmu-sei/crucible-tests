// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Users and Permissions Management', () => {
  test('View Users List', async ({ casterAuthenticatedPage: page }) => {

    // 1. Navigate to http://localhost:4310/admin
    await page.goto(Services.Caster.UI + '/admin');

    // expect: Admin page loads
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 10000 });

    // 2. Click on 'Users' in the sidebar
    await page.locator('mat-list-item').filter({ hasText: 'Users' }).click();

    // expect: Users list is displayed
    await expect(page).toHaveURL(/section=Users/);
    await expect(page.getByRole('table')).toBeVisible();

    // expect: Each user shows: ID, Name, Role
    await expect(page.getByRole('columnheader', { name: 'ID' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Role' })).toBeVisible();

    // expect: Admin User is visible in the list
    await expect(page.getByRole('cell', { name: 'Admin User' })).toBeVisible();

    // expect: Pagination controls are visible
    await expect(page.getByRole('status')).toBeVisible();

    // expect: Search box is available
    await expect(page.getByRole('textbox', { name: 'Search' })).toBeVisible();
  });
});
