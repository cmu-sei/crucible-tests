// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, PLAYER_THEMES, setPlayerTheme } from '../../fixtures';
import { closeMenuAndWaitForOverlay, expectBodyTheme } from '../../../theme-helpers';

// This spec is about the toggle itself, so the theme is the *starting* state: each
// run sets it, then asserts the switch reports it, that toggling flips the page to
// the other theme, and that toggling again comes back.
for (const theme of PLAYER_THEMES) {
  const other = theme === 'dark' ? 'light' : 'dark';

  test.describe(`${theme} theme › Home Page - My Views`, () => {
    test('Dark Theme Toggle', async ({ playerAuthenticatedPage: page }) => {
      // 1. Log in as admin user, starting in this run's theme
      // expect: User is on the home page
      await expect(page.getByText('My Views')).toBeVisible();
      await setPlayerTheme(page, theme);
      await expectBodyTheme(page, theme);

      // 2. Click the Menu button
      await page.getByRole('button', { name: 'Menu', exact: true }).click();

      // expect: A dropdown menu appears showing a 'Dark Theme' toggle switch,
      // reflecting the theme the page is in
      const darkThemeSwitch = page.getByRole('switch', { name: 'Dark Theme' });
      await expect(darkThemeSwitch).toBeVisible();
      if (theme === 'dark') {
        await expect(darkThemeSwitch).toBeChecked();
      } else {
        await expect(darkThemeSwitch).not.toBeChecked();
      }

      // 3. Toggle the Dark Theme switch
      await darkThemeSwitch.click();

      // expect: The application theme changes to the other theme
      // expect: Colors and backgrounds update to that theme
      if (other === 'dark') {
        await expect(darkThemeSwitch).toBeChecked();
      } else {
        await expect(darkThemeSwitch).not.toBeChecked();
      }
      await closeMenuAndWaitForOverlay(page);
      await expectBodyTheme(page, other);
      await expect(page.getByText('My Views')).toBeVisible();

      // 4. Toggle the Dark Theme switch again
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
      await expect(darkThemeSwitch).toBeVisible();
      await darkThemeSwitch.click();
      await closeMenuAndWaitForOverlay(page);

      // expect: The application theme changes back to the starting theme
      await expectBodyTheme(page, theme);
      await expect(page.getByText('My Views')).toBeVisible();
    });
  });
}
