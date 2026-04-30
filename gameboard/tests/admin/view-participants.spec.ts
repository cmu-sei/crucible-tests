// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin - Users', () => {
  test('View All Participants (Users List)', async ({ gameboardAuthenticatedPage: page }) => {
    await page.goto(Services.Gameboard.UI + '/admin/registrar/users', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible({ timeout: 15000 });

    // Search field is present.
    await expect(page.locator('input[type="search"]').first()).toBeVisible();
    // Filter and Sort controls are present.
    await expect(page.getByRole('button', { name: /^Filter$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Sort$/ })).toBeVisible();
    // Add Users button is present.
    await expect(page.getByRole('button', { name: /Add Users/i })).toBeVisible();
  });
});
