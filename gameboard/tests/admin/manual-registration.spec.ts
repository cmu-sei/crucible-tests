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

// Administrators can manually enroll users in games via POST /api/player
// (the same endpoint users call themselves). We exercise this by enrolling
// the admin user in a seeded game and verifying the player record is returned.
test.describe('Admin - Users', () => {
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
      name: `ManualReg-${Date.now()}`,
      startOffsetDays: -1,
      endOffsetDays: 30,
    });
  });

  test.afterEach(async () => {
    if (player) await deletePlayer(token, player.id);
    if (game) await deleteGame(token, game.id);
    if (previousSponsorId && token) await setAdminSponsor(token, previousSponsorId).catch(() => {});
    if (sponsor) await deleteSponsor(token, sponsor.id);
  });

  test('Manually Register User for Game', async ({ gameboardAuthenticatedPage: page }) => {
    player = await enrollAdmin(token, game.id);
    expect(player.gameId).toBe(game.id);
    expect(player.teamId).toBeTruthy();

    // UI sanity check — admin area still reachable.
    await page.goto(Services.Gameboard.UI + '/admin/registrar/players', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
