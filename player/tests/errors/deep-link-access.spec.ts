// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, serviceUrlPattern, PLAYER_THEMES, playerUrl, expectBodyTheme, dismissTransientOverlays } from '../../fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

for (const theme of PLAYER_THEMES) {
  test.describe(`${theme} theme › Error Handling and Edge Cases`, () => {
    test('Deep Link Access', async ({ page }) => {
      // 1. Copy a deep link URL (e.g., /view/:id)
      // Unauthenticated, so the theme rides on the deep link itself.
      const deepLinkUrl = playerUrl('/view/35d24422-5c69-4859-bb10-da240fe89902', theme);

      // 2. Navigate to deep link URL (unauthenticated via storageState override)
      await page.goto(deepLinkUrl);

      // expect: User is redirected to login
      await page.getByText('Sign in to your account').first().waitFor({ state: 'visible', timeout: 70000 });
      await expect(page).toHaveURL(serviceUrlPattern(Services.Keycloak));

      // 3. After login, user is redirected back to intended deep link
      await page.getByRole('textbox', { name: 'Username or email' }).fill('admin');
      await page.getByRole('textbox', { name: 'Password' }).fill('admin');
      await page.getByRole('button', { name: 'Sign In' }).click();

      // expect: After login, user is redirected back to intended deep link
      await page.waitForURL(serviceUrlPattern(Services.Player.UI), { timeout: 30000 });

      // The id names no view, and Player's view page sends an unknown view home (with
      // a "View Not Found" bottom sheet, when the deep link survived the login), so
      // the session settles on the home page. Dismiss any sheet, then check the deep
      // link's `?theme=` survived the login and was applied.
      await expect(page.getByText('My Views')).toBeVisible({ timeout: 30000 });
      await dismissTransientOverlays(page);
      await expectBodyTheme(page, theme);
    });
  });
}
