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
  test('Delete Group', async ({ casterAuthenticatedPage: page }) => {

    await gotoCasterGroupsAdmin(page);

    // 1. Create a group to delete
    await createCasterGroup(page, 'Group To Delete');
    const groupCell = casterGroupCell(page, 'Group To Delete');
    await expect(groupCell).toBeVisible();

    // 2. Click delete icon (trash, first button) for the group
    const groupRow = page.getByRole('row').filter({ has: groupCell });
    await groupRow.getByRole('button').first().click();

    // 3. Verify confirmation dialog appears
    // Scoped by name: an unscoped getByRole('dialog') also matches a previous
    // dialog that is still mid-exit-animation, which fails strict mode.
    const dialog = page.getByRole('dialog', { name: 'Delete Group?' });
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // 4. Click "No" to cancel deletion
    await dialog.getByRole('button', { name: 'No' }).click();
    await expect(dialog).toHaveCount(0, { timeout: 10000 });
    await expect(groupCell).toBeVisible();

    // 5. Click delete icon again and confirm
    // expect: Group is removed from the table
    await deleteCasterGroup(page, 'Group To Delete');
    await expect(groupCell).toHaveCount(0);
  });
});
