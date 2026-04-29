// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Groups Management', () => {
  test('Select Multiple Groups', async ({ casterAuthenticatedPage: page }) => {

    await page.goto(Services.Caster.UI + '/admin?section=Groups');
    await expect(page.getByRole('columnheader', { name: 'Group Name' })).toBeVisible({ timeout: 10000 });

    // 1. Create two groups for selection testing
    const createButton = page.getByRole('table').getByRole('button').first();

    await createButton.click();
    const input1 = page.getByRole('textbox').last();
    await expect(input1).toBeVisible({ timeout: 5000 });
    await input1.fill('Select Group 1');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('cell', { name: 'Select Group 1' })).toBeVisible({ timeout: 10000 });

    await createButton.click();
    const input2 = page.getByRole('textbox').last();
    await expect(input2).toBeVisible({ timeout: 5000 });
    await input2.fill('Select Group 2');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('cell', { name: 'Select Group 2' })).toBeVisible({ timeout: 10000 });

    // 2. Click on group rows to expand/select them
    const group1Row = page.getByRole('row').filter({ hasText: 'Select Group 1' });
    const group2Row = page.getByRole('row').filter({ hasText: 'Select Group 2' });

    await group1Row.getByRole('cell').last().click();
    await group2Row.getByRole('cell').last().click();

    // Cleanup: reload to clear any expanded rows and error overlays, then delete groups
    await page.goto(Services.Caster.UI + '/admin?section=Groups');
    await expect(page.getByRole('columnheader', { name: 'Group Name' })).toBeVisible({ timeout: 10000 });

    for (const groupName of ['Select Group 1', 'Select Group 2']) {
      const cell = page.getByRole('cell', { name: groupName, exact: true });
      await expect(cell).toBeVisible({ timeout: 5000 });
      const row = page.getByRole('row').filter({ has: cell });
      await row.getByRole('button').first().click();
      const deleteDialog = page.getByRole('dialog', { name: 'Delete Group?' });
      await expect(deleteDialog).toBeVisible({ timeout: 5000 });
      await deleteDialog.getByRole('button', { name: 'Delete' }).click();
      await expect(deleteDialog).not.toBeVisible({ timeout: 10000 });
      await expect(cell).not.toBeVisible({ timeout: 10000 });
    }

    // Final verification: neither group exists
    await expect(page.getByRole('cell', { name: 'Select Group 1', exact: true })).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('cell', { name: 'Select Group 2', exact: true })).not.toBeVisible({ timeout: 5000 });
  });
});
