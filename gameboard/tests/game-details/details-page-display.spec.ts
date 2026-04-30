// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getAdminToken, createGame, deleteGame, CreatedGame } from '../../api-helpers';

test.describe('Game Details and Registration', () => {
  let token: string;
  let game: CreatedGame;

  test.beforeEach(async () => {
    token = await getAdminToken();
    game = await createGame(token, {
      name: `Details-${Date.now()}`,
      startOffsetDays: -1,
      endOffsetDays: 30,
    });
  });

  test.afterEach(async () => {
    if (game) await deleteGame(token, game.id);
  });

  test('Game Details Page Display', async ({ gameboardAuthenticatedPage: page }) => {
    await page.goto(`${Services.Gameboard.UI}/game/${game.id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator(`text=${game.name}`).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Enrollment' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Info' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Scoreboard' })).toBeVisible();
  });
});
