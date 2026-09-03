// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, clickAddRoleButton } from '../../fixtures';

test.describe('Roles and Permissions Management', () => {
  test('Delete System Role', async ({ casterAuthenticatedPage: page, cleanupCasterRole }) => {

    const roleName = 'Role To Delete';
    // Register for pre-clean (remove leftovers) and post-clean (if test fails midway)
    await cleanupCasterRole(roleName);

    // 1. Navigate to Roles admin section
    await page.goto(Services.Caster.UI + '/admin?section=Roles');
    await expect(page.getByRole('columnheader', { name: 'Permissions' })).toBeVisible({ timeout: 10000 });

    // Create the custom role to delete
    await clickAddRoleButton(page);
    const createDialog = page.getByRole('dialog');
    await createDialog.getByRole('textbox', { name: 'Name' }).fill(roleName);
    await createDialog.getByRole('button', { name: 'Save' }).click();

    const roleHeader = page.getByRole('columnheader', { name: roleName });
    await expect(roleHeader).toBeVisible({ timeout: 10000 });

    // 2. Click the Delete Role icon for the custom role
    const deleteButton = roleHeader.getByRole('button', { name: 'Delete Role' });
    await deleteButton.click();

    // expect: Confirmation dialog appears
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 3. Click Cancel (scoped to dialog)
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    // expect: Dialog closes, role is not deleted
    await expect(dialog).not.toBeVisible();
    await expect(roleHeader).toBeVisible();

    // 4. Click delete icon again and confirm deletion
    await deleteButton.click();
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await dialog.getByRole('button', { name: 'Delete' }).click();

    // expect: Role is deleted successfully
    await expect(roleHeader).not.toBeVisible({ timeout: 10000 });
  });
});
