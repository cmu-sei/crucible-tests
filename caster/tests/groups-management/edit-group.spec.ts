// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Groups Management', () => {
  test('Edit Group', async ({ casterAuthenticatedPage: page }) => {

    await page.goto(Services.Caster.UI + '/admin?section=Groups');
    await expect(page.getByRole('columnheader', { name: 'Group Name' })).toBeVisible({ timeout: 10000 });

    // 1. Create a group first
    const createButton = page.getByRole('table').getByRole('button').first();
    await createButton.click();
    const groupNameInput = page.getByRole('textbox').last();
    await expect(groupNameInput).toBeVisible({ timeout: 5000 });
    await groupNameInput.fill('Group To Edit');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('cell', { name: 'Group To Edit' })).toBeVisible({ timeout: 10000 });

    // 2. Click the rename button (second button, edit icon) on the group row
    const groupRow = page.getByRole('row').filter({ hasText: 'Group To Edit' });
    await groupRow.getByRole('button').last().click();

    // 3. Verify rename dialog appears
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 4. Clear and enter new name
    const nameInput = dialog.getByRole('textbox', { name: 'Name' });
    await nameInput.clear();
    await nameInput.fill('Updated Group Name');

    // 5. Click Save
    await dialog.getByRole('button', { name: 'Save' }).click();

    // expect: Updated group name appears in the table
    await expect(page.getByRole('cell', { name: 'Updated Group Name' })).toBeVisible({ timeout: 10000 });

    // Cleanup: delete the renamed group
    const updatedRow = page.getByRole('row').filter({ hasText: 'Updated Group Name' });
    await updatedRow.getByRole('button').first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('cell', { name: 'Updated Group Name' })).not.toBeVisible({ timeout: 10000 });
  });
});
