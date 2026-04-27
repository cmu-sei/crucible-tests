// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Views', () => {
  test('Access Administration Section', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin user
    // expect: User is on the home page
    await expect(page.getByText('My Views')).toBeVisible();

    // 2. Click the Menu button and select 'Administration'
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();

    // expect: User is navigated to the administration page
    // expect: The URL changes to /admin
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // expect: Five sections are shown: Views, Application Templates, Users, Roles, Subscriptions
    await expect(page.getByRole('button', { name: 'Views' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Application Templates' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Users Users' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Roles Roles' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Subscriptions Subscriptions' })).toBeVisible();
  });
});
