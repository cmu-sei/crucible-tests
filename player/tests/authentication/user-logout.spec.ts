// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, serviceUrlPattern, PLAYER_THEMES, setPlayerTheme } from '../../fixtures';

// Logging out ends the Keycloak session behind the saved admin login, which the
// other Player specs and the playerVm and console specs keep reusing. Sign in
// with a session of this spec's own instead.
test.use({ storageState: { cookies: [], origins: [] } });

for (const theme of PLAYER_THEMES) {
  test.describe(`${theme} theme › Authentication`, () => {
    test('User Logout', async ({ playerAuthenticatedPage: page }) => {
      await setPlayerTheme(page, theme);
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

      // expect: User is logged out and redirected to the Keycloak login page. Logout is
      // `signoutRedirect`, which ends this spec's own Keycloak session, so Player's
      // post-logout landing sends the browser back to the sign-in form.
      await expect(page).toHaveURL(serviceUrlPattern(Services.Keycloak), { timeout: 30000 });
      await expect(page.getByRole('textbox', { name: 'Username or email' })).toBeVisible();
    });
  });
}
