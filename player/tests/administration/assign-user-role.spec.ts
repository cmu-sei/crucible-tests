// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Users', () => {
  test('Assign Role to User', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Users
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Users Users' }).click();

    // expect: The Users section is displayed
    await expect(page.getByRole('columnheader', { name: 'Role' })).toBeVisible();

    // 2. Click the role dropdown for a user showing 'None'
    const roleDropdown = page.getByRole('combobox', { name: 'None' }).first();
    await expect(roleDropdown).toBeVisible();
    await roleDropdown.click();

    // expect: A dropdown opens showing available roles
    // Available roles should be listed (e.g., None, Administrator, Content Developer)
    await expect(page.getByRole('option', { name: 'Administrator' })).toBeVisible({ timeout: 5000 });
  });
});
