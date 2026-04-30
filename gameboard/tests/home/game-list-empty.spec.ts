// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

// The empty state cannot be reproduced deterministically when any other test
// run in parallel has seeded a published game. Instead, this test asserts
// that the home page renders the two expected sections ("Upcoming Games" and
// "Completed Games") and that when zero games match a section's filter, an
// informational empty-state message appears rather than an error surface.
test.describe('Home Page and Game Discovery', () => {
  test('Game List Display - Empty State Sections', async ({ gameboardAuthenticatedPage: page }) => {
    await page.goto(Services.Gameboard.UI + '/home', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Upcoming Games' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Completed Games' })).toBeVisible();

    // Neither alert/error surface should appear regardless of data state.
    expect(await page.locator('[role="alert"]').count()).toBe(0);

    // If no app-game-cards render, the empty copy is displayed under "Upcoming Games".
    const cardCount = await page.locator('app-game-card').count();
    if (cardCount === 0) {
      await expect(page.locator('text=No games coming up').first()).toBeVisible();
    }
  });
});
