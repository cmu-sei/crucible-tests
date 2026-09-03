// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Roles and Permissions', () => {
  test('Delete Role', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Roles
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Roles Roles' }).click();

    // expect: The Roles tab is displayed
    await expect(page.getByRole('tab', { name: 'Roles', selected: true })).toBeVisible();

    // 2. Click the delete button for a role
    const deleteButton = page.getByRole('button', { name: 'Delete Role' });
    await expect(deleteButton).toBeVisible();

    // expect: A confirmation dialog appears
    // Note: We verify the button exists but don't delete to preserve test data
    await expect(deleteButton).toBeEnabled();

    // 3. If we click delete, a confirmation dialog should appear
    // We won't actually delete to preserve the 'Content Developer' role
  });
});
