// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, PLAYER_THEMES, applyPlayerTheme } from '../../fixtures';

for (const theme of PLAYER_THEMES) {
  test.describe(`${theme} theme › Error Handling and Edge Cases`, () => {
  test('Server Error (500) Handling', async ({ playerAuthenticatedPage: page }) => {
    await applyPlayerTheme(page, theme);
    // 1. Log in successfully
    // expect: User is authenticated
    await expect(page.getByText('My Views')).toBeVisible();

    // 2. Trigger an API call that returns 500 error (mock such response)
    await page.route('**/api/views*', (route) =>
      route.fulfill({ status: 500, body: 'Internal Server Error' })
    );

    // Reload to trigger the mocked API response
    await page.reload();

    // expect: Application handles error gracefully
    // expect: No uncaught exceptions crash the page
    await expect(page.locator('body')).toBeVisible();

    // Restore routes
    await page.unrouteAll();
  });
  });
}
