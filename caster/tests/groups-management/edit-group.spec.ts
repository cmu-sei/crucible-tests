// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  casterGroupCell,
  createCasterGroup,
  deleteCasterGroup,
  gotoCasterGroupsAdmin,
} from '../../fixtures';

test.describe('Groups Management', () => {
  test('Edit Group', async ({ casterAuthenticatedPage: page }) => {

    await gotoCasterGroupsAdmin(page);

    // 1. Create a group first
    await createCasterGroup(page, 'Group To Edit');
    const originalCell = casterGroupCell(page, 'Group To Edit');
    await expect(originalCell).toBeVisible();

    // 2. Click the rename button (second button, edit icon) on the group row
    const groupRow = page.getByRole('row').filter({ has: originalCell });
    await groupRow.getByRole('button').last().click();

    // 3. Verify rename dialog appears
    // The rename dialog's accessible name embeds the group name. Scoping by it
    // keeps this from also matching a dialog still playing its exit animation,
    // which would fail strict mode.
    const dialog = page.getByRole('dialog', { name: 'Rename Group To Edit' });
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // 4. Clear and enter new name
    const nameInput = dialog.getByRole('textbox', { name: 'Name' });
    await nameInput.clear();
    await nameInput.fill('Updated Group Name');

    // 5. Click Save
    await dialog.getByRole('button', { name: 'Save' }).click();

    // expect: Updated group name appears in the table
    const updatedCell = casterGroupCell(page, 'Updated Group Name');
    await expect(updatedCell).toBeVisible({ timeout: 20000 });
    await expect(originalCell).toHaveCount(0);

    // Cleanup: delete the renamed group
    await deleteCasterGroup(page, 'Updated Group Name');
    await expect(updatedCell).toHaveCount(0);
  });
});
