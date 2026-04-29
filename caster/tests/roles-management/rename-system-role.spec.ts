// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, clickAddRoleButton } from '../../fixtures';

test.describe('Roles and Permissions Management', () => {
  test('Rename System Role', async ({ casterAuthenticatedPage: page, cleanupCasterRole }) => {

    const originalName = 'Role To Rename';
    const renamedName = 'Renamed Custom Role';
    // Register both names for pre-clean and post-clean
    await cleanupCasterRole(originalName);
    await cleanupCasterRole(renamedName);

    // 1. Navigate to Roles admin section
    await page.goto(Services.Caster.UI + '/admin?section=Roles');
    await expect(page.getByRole('columnheader', { name: 'Permissions' })).toBeVisible({ timeout: 10000 });

    // First create a custom role to rename
    await clickAddRoleButton(page);
    const createDialog = page.getByRole('dialog');
    await createDialog.getByRole('textbox', { name: 'Name' }).fill(originalName);
    await createDialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(originalName)).toBeVisible({ timeout: 10000 });

    // 2. Click on the Rename Role icon for the custom role
    const roleHeader = page.getByRole('columnheader', { name: originalName });
    const renameButton = roleHeader.getByRole('button', { name: 'Rename Role' });
    await renameButton.click();

    // expect: Rename dialog is displayed
    const renameDialog = page.getByRole('dialog');
    await expect(renameDialog).toBeVisible({ timeout: 5000 });

    // 3. Enter 'Renamed Custom Role' as the new name
    const renameInput = renameDialog.getByRole('textbox', { name: 'Name' });
    await renameInput.clear();
    await renameInput.fill(renamedName);
    await renameDialog.getByRole('button', { name: 'Save' }).click();

    // expect: Role is renamed successfully
    await expect(page.getByText(renamedName)).toBeVisible({ timeout: 10000 });
  });
});
