// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getAdminToken, createGame, deleteGame, CreatedGame } from '../../api-helpers';

// Gameboard groups games into "Live!", "Upcoming Games", and "Completed Games"
// section headings rather than an explicit filter. We seed one game in the
// future and verify the "Upcoming Games" heading renders.
test.describe('Home Page and Game Discovery', () => {
  let token: string;
  let upcoming: CreatedGame;

  test.beforeEach(async () => {
    token = await getAdminToken();
    upcoming = await createGame(token, {
      name: `Upcoming-${Date.now()}`,
      startOffsetDays: 30,
      endOffsetDays: 60,
    });
  });

  test.afterEach(async () => {
    if (upcoming) await deleteGame(token, upcoming.id);
  });

  test('Game List Grouping - Upcoming Section', async ({ gameboardAuthenticatedPage: page }) => {
    await page.goto(Services.Gameboard.UI + '/home', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Upcoming Games' })).toBeVisible();

    // After seeding a future game, at least one game card renders on the home page.
    const cards = page.locator('app-game-card');
    await expect(cards.first()).toBeVisible({ timeout: 15000 });
  });
});
