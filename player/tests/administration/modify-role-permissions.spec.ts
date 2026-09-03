// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Roles and Permissions', () => {
  test('Modify Role Permissions', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Roles
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Roles Roles' }).click();

    // expect: The Roles tab displays the permissions matrix
    await expect(page.getByRole('tab', { name: 'Roles', selected: true })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    // 2. Click a checkbox to assign or remove a permission from a role
    // Find the 'CreateViews' row, 'Content Developer' column checkbox
    const createViewsRow = page.getByRole('row').filter({ hasText: 'CreateViews' });
    const contentDevCheckbox = createViewsRow.getByRole('checkbox');

    // Get the current state
    const wasChecked = await contentDevCheckbox.isChecked();

    // Click to toggle
    await contentDevCheckbox.click();

    // expect: The checkbox state toggles
    if (wasChecked) {
      await expect(contentDevCheckbox).not.toBeChecked();
    } else {
      await expect(contentDevCheckbox).toBeChecked();
    }

    // expect: The permission is assigned or removed from the role
    // Revert the change
    await contentDevCheckbox.click();
    if (wasChecked) {
      await expect(contentDevCheckbox).toBeChecked();
    } else {
      await expect(contentDevCheckbox).not.toBeChecked();
    }
  });
});
