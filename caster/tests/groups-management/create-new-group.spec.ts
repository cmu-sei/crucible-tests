// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  casterGroupCell,
  deleteCasterGroup,
  gotoCasterGroupsAdmin,
  openCreateGroupDialog,
} from '../../fixtures';

test.describe('Groups Management', () => {
  test('Create New Group', async ({ casterAuthenticatedPage: page }) => {

    // 1. Navigate to Groups admin section
    // expect: Groups list is visible with create button
    await gotoCasterGroupsAdmin(page);
    await expect(page.getByRole('table').getByRole('button').first()).toBeVisible();

    // 2. Click the Create Group or add button
    // expect: Group creation dialog is displayed with form fields
    const dialog = await openCreateGroupDialog(page);

    // 3. Enter Test Infrastructure Group in the group name field
    // expect: Name field accepts input
    const groupNameInput = dialog.getByRole('textbox', { name: 'Name' });
    await groupNameInput.fill('Test Infrastructure Group');
    await expect(groupNameInput).toHaveValue('Test Infrastructure Group');

    // 4. Click Save or Create button
    // expect: New group appears in the groups table
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(casterGroupCell(page, 'Test Infrastructure Group')).toBeVisible({ timeout: 20000 });

    // Cleanup: delete the created group
    await deleteCasterGroup(page, 'Test Infrastructure Group');
    await expect(casterGroupCell(page, 'Test Infrastructure Group')).toHaveCount(0);
  });
});
