// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Views', () => {
  test('Select Multiple Views', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Views
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // expect: The Views admin section is displayed
    await expect(page.getByRole('heading', { name: 'Views' })).toBeVisible();

    // 2. Click the checkbox in the header row
    const headerCheckbox = page.getByRole('row').first().getByRole('checkbox');
    await headerCheckbox.click();

    // expect: All views are selected
    // expect: All individual checkboxes are checked
    const rowCheckboxes = page.getByRole('row').getByRole('checkbox');
    const count = await rowCheckboxes.count();
    for (let i = 1; i < count; i++) {
      await expect(rowCheckboxes.nth(i)).toBeChecked();
    }

    // 3. Click the header checkbox again
    await headerCheckbox.click();

    // expect: All views are deselected
    for (let i = 1; i < count; i++) {
      await expect(rowCheckboxes.nth(i)).not.toBeChecked();
    }

    // 4. Click individual view checkboxes
    const firstRowCheckbox = page.getByRole('row').nth(1).getByRole('checkbox');
    await firstRowCheckbox.click();

    // expect: Only selected views have checked checkboxes
    await expect(firstRowCheckbox).toBeChecked();
  });
});
