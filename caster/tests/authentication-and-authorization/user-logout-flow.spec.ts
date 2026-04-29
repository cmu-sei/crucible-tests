// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Authentication and Authorization', () => {
  test('User Logout Flow', async ({ casterAuthenticatedPage: page }) => {

    // 1. Log in as admin user
    // expect: Successfully authenticated and viewing the home page
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();

    // 2. Click on the user menu in the topbar
    await page.getByRole('button', { name: 'Admin User' }).click();

    // expect: A dropdown menu appears with logout option
    await expect(page.getByRole('menuitem', { name: 'Logout' })).toBeVisible();

    // 3. Click 'Logout' option
    await page.getByRole('menuitem', { name: 'Logout' }).click();

    // expect: The user is logged out
    // expect: Authentication tokens are cleared
    // expect: The user is redirected to the Keycloak login page
    await expect(page).toHaveURL(/.*localhost:8443.*realms\/crucible/, { timeout: 30000 });
    await expect(page.getByText('Sign in to your account')).toBeVisible();
  });
});
