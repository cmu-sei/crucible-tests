// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import {
  getAdminToken,
  createGame,
  deleteGame,
  createSponsor,
  deleteSponsor,
  setAdminSponsor,
  enrollAdmin,
  deletePlayer,
  CreatedGame,
  CreatedSponsor,
  CreatedPlayer,
} from '../../api-helpers';

test.describe('Game Details and Registration', () => {
  let token: string;
  let game: CreatedGame;
  let sponsor: CreatedSponsor;
  let player: CreatedPlayer | null = null;
  let previousSponsorId = 'other';

  test.beforeEach(async () => {
    token = await getAdminToken();
    sponsor = await createSponsor(token);
    ({ previousSponsorId } = await setAdminSponsor(token, sponsor.id));
    game = await createGame(token, {
      name: `Unreg-${Date.now()}`,
      startOffsetDays: -1,
      endOffsetDays: 30,
    });
    player = await enrollAdmin(token, game.id);
  });

  test.afterEach(async () => {
    if (player) await deletePlayer(token, player.id);
    if (game) await deleteGame(token, game.id);
    if (previousSponsorId && token) await setAdminSponsor(token, previousSponsorId).catch(() => {});
    if (sponsor) await deleteSponsor(token, sponsor.id);
  });

  test('Unregister from Game', async ({ gameboardAuthenticatedPage: page }) => {
    await page.goto(`${Services.Gameboard.UI}/game/${game.id}`, { waitUntil: 'networkidle' });
    await expect(page.locator(`text=${game.name}`).first()).toBeVisible({ timeout: 15000 });

    // When enrolled, an "Unenroll" button replaces "Enroll".
    const unenrollBtn = page.getByRole('button', { name: /Unenroll/i });
    await expect(unenrollBtn).toBeVisible({ timeout: 15000 });
  });
});
