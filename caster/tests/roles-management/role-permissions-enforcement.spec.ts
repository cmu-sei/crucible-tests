// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Roles and Permissions Management', () => {
  test('Role Permissions Enforcement', async ({ casterAuthenticatedPage: page }) => {

    // 1. Log in as admin user (who has full permissions)
    // 2. Navigate to Roles admin section
    await page.goto(Services.Caster.UI + '/admin?section=Roles');

    // expect: Roles page is accessible
    await expect(page.getByRole('tab', { name: 'Roles', exact: true })).toBeVisible({ timeout: 10000 });

    // expect: Permissions matrix is visible
    await expect(page.getByRole('columnheader', { name: 'Permissions' })).toBeVisible();

    // expect: User can view all roles and their permissions
    await expect(page.getByRole('columnheader', { name: 'Administrator' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Content Developer' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Observer' })).toBeVisible();

    // expect: As admin, create role button is available
    const permHeader = page.getByRole('columnheader', { name: 'Permissions' });
    const addButton = permHeader.getByRole('button').first();
    await expect(addButton).toBeVisible();

    // expect: Content Developer has rename and delete buttons
    const cdHeader = page.getByRole('columnheader', { name: 'Content Developer' });
    await expect(cdHeader.getByRole('button', { name: 'Rename Role' })).toBeVisible();
    await expect(cdHeader.getByRole('button', { name: 'Delete Role' })).toBeVisible();
  });
});
