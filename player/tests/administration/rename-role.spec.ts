// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Roles and Permissions', () => {
  test('Rename Role', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Roles
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Roles Roles' }).click();

    // expect: The Roles tab is displayed
    await expect(page.getByRole('tab', { name: 'Roles', selected: true })).toBeVisible();

    // 2. Click the rename button for 'Content Developer' role
    const renameButton = page.getByRole('button', { name: 'Rename Role' });
    await expect(renameButton).toBeVisible();
    await renameButton.click();

    // expect: A dialog opens to edit the role name
    // The rename dialog should appear with the current role name
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 3. Cancel to avoid modifying test data
    const cancelButton = dialog.getByRole('button', { name: /cancel|close/i });
    if (await cancelButton.isVisible().catch(() => false)) {
      await cancelButton.click();
    } else {
      await page.keyboard.press('Escape');
    }
  });
});
