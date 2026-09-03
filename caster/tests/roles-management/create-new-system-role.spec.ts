// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, clickAddRoleButton } from '../../fixtures';

test.describe('Roles and Permissions Management', () => {
  test('Create New System Role', async ({ casterAuthenticatedPage: page, cleanupCasterRole }) => {

    const roleName = 'Test Custom Role';
    // Register for pre-clean (remove leftovers) and post-clean
    await cleanupCasterRole(roleName);

    // 1. Navigate to Roles admin section - Roles tab
    await page.goto(Services.Caster.UI + '/admin?section=Roles');

    // expect: Roles matrix is visible with create button
    await expect(page.getByRole('columnheader', { name: 'Permissions' })).toBeVisible({ timeout: 10000 });

    // 2. Click Add Role button (+ icon in the Permissions header)
    await clickAddRoleButton(page);

    // expect: Role creation dialog is displayed
    const dialog = page.getByRole('dialog');

    // 3. Enter 'Test Custom Role' as the role name
    const roleNameInput = dialog.getByRole('textbox', { name: 'Name' });
    await roleNameInput.fill(roleName);
    await dialog.getByRole('button', { name: 'Save' }).click();

    // expect: New role is created successfully
    // expect: New role column appears in the permissions matrix
    await expect(page.getByText(roleName)).toBeVisible({ timeout: 10000 });
  });
});
