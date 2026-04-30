// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getAdminToken, createGame, deleteGame, CreatedGame } from '../../api-helpers';

// Gameboard's per-game scoreboard is reachable at /game/{id} under the
// "Scoreboard" heading. For a game with no players, the scoreboard shows a
// "No one's scored in this game yet" message.
test.describe('Leaderboard', () => {
  let token: string;
  let game: CreatedGame;

  test.beforeEach(async () => {
    token = await getAdminToken();
    game = await createGame(token, {
      name: `Scoreboard-${Date.now()}`,
      startOffsetDays: -1,
      endOffsetDays: 30,
    });
  });

  test.afterEach(async () => {
    if (game) await deleteGame(token, game.id);
  });

  test('Leaderboard Display - Game Scoreboard Section', async ({ gameboardAuthenticatedPage: page }) => {
    await page.goto(`${Services.Gameboard.UI}/game/${game.id}`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Scoreboard' })).toBeVisible({ timeout: 15000 });
    // With no players yet, Gameboard shows an informational placeholder.
    await expect(page.locator("text=/No one's scored/i").first()).toBeVisible();
  });
});
