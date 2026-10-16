// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test, PLAYER_THEMES, setPlayerTheme } from '../fixtures';

// Generator template: every Player spec runs once per theme, signed in through
// the `playerAuthenticatedPage` fixture, with the theme applied before the first
// step. Specs generated from this seed start out that way too.
for (const theme of PLAYER_THEMES) {
  test.describe(`${theme} theme › Test group`, () => {
    test('seed', async ({ playerAuthenticatedPage: page }) => {
      await setPlayerTheme(page, theme);

      // generate code here.
    });
  });
}
