// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, PLAYER_THEMES, setPlayerTheme } from '../../fixtures';

for (const theme of PLAYER_THEMES) {
  test.describe(`${theme} theme › Error Handling and Edge Cases`, () => {
    test('Navigate to Non-Existent View', async ({ playerAuthenticatedPage: page }) => {
      await setPlayerTheme(page, theme);
      // 1. Log in as admin user
      // expect: User is authenticated
      await expect(page.getByText('My Views')).toBeVisible();

      // 2. Navigate to /view/00000000-0000-0000-0000-000000000000 (invalid view ID)
      await page.goto(`${Services.Player.UI}/view/00000000-0000-0000-0000-000000000000`);

      // expect: A bottom-sheet message explains why access failed
      // Pending upstream: PlayerComponent's data$ is a cold observable subscribed twice (once
      // in ngOnInit for team permissions, once by the template's async pipe), so the failed
      // view lookup runs twice and its catchError opens the "View Not Found" bottom sheet
      // twice. MatBottomSheet keeps one sheet open, so the second replaces the first, but
      // both are in the DOM during the swap animation. Waiting for the count to settle at one
      // before checking visibility; once data$ is shared (e.g. shareReplay) only one sheet is
      // ever opened and the toHaveCount(1) waits become redundant.
      const heading = page.getByRole('heading', { name: 'View Not Found', exact: true });
      const message = page.getByText(
        'The view you are trying to access no longer exists or you do not have permission to access it.'
      );
      await expect(heading).toHaveCount(1);
      await expect(heading).toBeVisible();
      await expect(message).toHaveCount(1);
      await expect(message).toBeVisible();

      // expect: The app returns the user to the home page
      await expect(page.getByText('My Views')).toBeVisible();
      await expect(page).not.toHaveURL(/\/view\//);
    });
  });
}
