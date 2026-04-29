// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Groups Management', () => {
  test('Delete Group', async ({ casterAuthenticatedPage: page }) => {

    await page.goto(Services.Caster.UI + '/admin?section=Groups');
    await expect(page.getByRole('columnheader', { name: 'Group Name' })).toBeVisible({ timeout: 10000 });

    // 1. Create a group to delete
    const createButton = page.getByRole('table').getByRole('button').first();
    await createButton.click();
    const groupNameInput = page.getByRole('textbox').last();
    await expect(groupNameInput).toBeVisible({ timeout: 5000 });
    await groupNameInput.fill('Group To Delete');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('cell', { name: 'Group To Delete' })).toBeVisible({ timeout: 10000 });

    // 2. Click delete icon (trash, first button) for the group
    const groupRow = page.getByRole('row').filter({ hasText: 'Group To Delete' });
    await groupRow.getByRole('button').first().click();

    // 3. Verify confirmation dialog appears
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 4. Click "No" to cancel deletion
    await page.getByRole('button', { name: 'No' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('cell', { name: 'Group To Delete' })).toBeVisible();

    // 5. Click delete icon again and confirm
    await groupRow.getByRole('button').first().click();
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Delete' }).click();

    // expect: Group is removed from the table
    await expect(page.getByRole('cell', { name: 'Group To Delete' })).not.toBeVisible({ timeout: 10000 });
  });
});
