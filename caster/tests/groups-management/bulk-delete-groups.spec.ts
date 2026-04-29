// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Groups Management', () => {
  test('Bulk Delete Groups', async ({ casterAuthenticatedPage: page }) => {

    await page.goto(Services.Caster.UI + '/admin?section=Groups');
    await expect(page.getByRole('columnheader', { name: 'Group Name' })).toBeVisible({ timeout: 10000 });

    // 1. Create multiple groups
    const createButton = page.getByRole('table').getByRole('button').first();

    await createButton.click();
    const input1 = page.getByRole('textbox').last();
    await expect(input1).toBeVisible({ timeout: 5000 });
    await input1.fill('Bulk Delete 1');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('cell', { name: 'Bulk Delete 1' })).toBeVisible({ timeout: 10000 });

    await createButton.click();
    const input2 = page.getByRole('textbox').last();
    await expect(input2).toBeVisible({ timeout: 5000 });
    await input2.fill('Bulk Delete 2');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('cell', { name: 'Bulk Delete 2' })).toBeVisible({ timeout: 10000 });

    // 2. Delete each group individually (no bulk delete UI with checkboxes available)
    for (const groupName of ['Bulk Delete 1', 'Bulk Delete 2']) {
      const row = page.getByRole('row').filter({ hasText: groupName });
      await row.getByRole('button').first().click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByRole('cell', { name: groupName })).not.toBeVisible({ timeout: 10000 });
    }
  });
});
