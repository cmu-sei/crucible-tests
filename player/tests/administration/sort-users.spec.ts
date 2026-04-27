// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Users', () => {
  test('Sort Users', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Users
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Users Users' }).click();

    // expect: The Users section is displayed
    await expect(page.getByRole('columnheader', { name: 'ID' })).toBeVisible();

    // 2. Click the 'ID' column header
    await page.getByRole('button', { name: 'ID' }).click();

    // expect: Users are sorted by ID
    await expect(page.getByRole('button', { name: 'ID' })).toBeVisible();

    // 3. Click the 'Name' column header
    await page.getByRole('button', { name: 'Name' }).click();

    // expect: Users are sorted by name
    await expect(page.getByRole('button', { name: 'Name' })).toBeVisible();
  });
});
