// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Authentication', () => {
  test('User Logout', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin user
    // expect: User is successfully authenticated and on the home page
    await expect(page.getByText('My Views')).toBeVisible();

    // 2. Click the Menu button with user name
    await page.getByRole('button', { name: 'Menu' }).click();

    // expect: A dropdown menu appears with 'Administration', 'Logout', and 'Dark Theme' options
    await expect(page.getByRole('menuitem', { name: 'Administration' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Logout' })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Dark Theme' })).toBeVisible();

    // 3. Click the 'Logout' option
    await page.getByRole('menuitem', { name: 'Logout' }).click();

    // expect: User is logged out
    // expect: User is redirected to Keycloak or login page
    await expect(page).toHaveURL(/localhost:8443/, { timeout: 30000 });
  });
});
