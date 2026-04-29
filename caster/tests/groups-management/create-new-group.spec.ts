// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Groups Management', () => {
  test('Create New Group', async ({ casterAuthenticatedPage: page }) => {

    // 1. Navigate to Groups admin section
    await page.goto(Services.Caster.UI + '/admin?section=Groups');
    await expect(page.getByRole('columnheader', { name: 'Group Name' })).toBeVisible({ timeout: 10000 });

    // 2. Click the Create Group button (+ icon)
    const createButton = page.getByRole('table').getByRole('button').first();
    await createButton.click();

    // 3. Enter 'Test Infrastructure Group' in the group name field
    const groupNameInput = page.getByRole('textbox').last();
    await expect(groupNameInput).toBeVisible({ timeout: 5000 });
    await groupNameInput.fill('Test Infrastructure Group');
    await expect(groupNameInput).toHaveValue('Test Infrastructure Group');

    // 4. Press Enter to save
    await page.keyboard.press('Enter');

    // expect: New group appears in the groups table
    await expect(page.getByRole('cell', { name: 'Test Infrastructure Group' })).toBeVisible({ timeout: 10000 });

    // Cleanup: delete the created group
    const groupRow = page.getByRole('row').filter({ hasText: 'Test Infrastructure Group' });
    await groupRow.getByRole('button').first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('cell', { name: 'Test Infrastructure Group' })).not.toBeVisible({ timeout: 10000 });
  });
});
