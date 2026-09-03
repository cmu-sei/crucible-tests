// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getAdminToken, createGame, deleteGame, CreatedGame } from '../../api-helpers';

// Gameboard's home groups published games into three sections: "Live!",
// "Upcoming Games", and "Completed Games". A currently-in-window game appears
// under "Live!". Each game renders as an <app-game-card> inside a card-wrapper
// that shows the game's cardText fields (not the game name itself).
test.describe('Home Page and Game Discovery', () => {
  let token: string;
  let game: CreatedGame;
  const cardText = `LIVE-${Date.now()}`;

  test.beforeEach(async () => {
    token = await getAdminToken();
    game = await createGame(token, {
      name: `ListActive-${Date.now()}`,
      startOffsetDays: -1,
      endOffsetDays: 30,
    });
  });

  test.afterEach(async () => {
    if (game) await deleteGame(token, game.id);
  });

  test('Game List Display - Active Games', async ({ gameboardAuthenticatedPage: page }) => {
    await page.goto(Services.Gameboard.UI + '/home', { waitUntil: 'networkidle' });

    // The "Live!" section heading appears when at least one in-window game exists.
    await expect(page.getByRole('heading', { name: 'Live!' })).toBeVisible({ timeout: 15000 });

    // At least one <app-game-card> is rendered in the live section.
    const liveCards = page.locator('app-game-card');
    await expect(liveCards.first()).toBeVisible();
    expect(await liveCards.count()).toBeGreaterThanOrEqual(1);
  });
});
