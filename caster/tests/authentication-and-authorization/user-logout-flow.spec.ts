// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, serviceUrlPattern, CASTER_THEMES, setCasterTheme } from '../../fixtures';

// Logout must begin with a fresh interactive session, not the shared state used
// by ordinary authenticated specs.
test.use({ storageState: { cookies: [], origins: [] } });

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Authentication and Authorization`, () => {
    test('User Logout Flow', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      // 1. Log in as admin user
      // expect: Successfully authenticated and viewing the home page
      await expect(page.getByRole('button', { name: 'Admin User', exact: true })).toBeVisible();

      // 2. Click on the user menu in the topbar
      await page.getByRole('button', { name: 'Admin User', exact: true }).click();

      // expect: A dropdown menu appears with logout option
      await expect(page.getByRole('menuitem', { name: 'Logout' })).toBeVisible();

      // 3. Click 'Logout' option
      await page.getByRole('menuitem', { name: 'Logout' }).click();

      // expect: The user is logged out
      // expect: Authentication tokens are cleared
      // expect: The user is redirected to the Keycloak login page
      await expect(page).toHaveURL(serviceUrlPattern(Services.Keycloak), { timeout: 30000 });
      await expect(page.getByText('Sign in to your account')).toBeVisible();
    });
  });
}
