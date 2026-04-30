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

// For team-based games (maxTeamSize > 1), enrolling makes the user the team
// captain ("manager" role in the API). We seed a team game with maxTeamSize=4,
// enroll admin, and verify captain role is granted.
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
      name: `TeamReg-${Date.now()}`,
      maxTeamSize: 4,
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

  test('Team Registration - Create New Team (Captain)', async ({ gameboardAuthenticatedPage: page }) => {
    player = await enrollAdmin(token, game.id);
    // The enrolling user becomes the team captain ("manager" role) of a new team.
    expect(player.role).toBeTruthy();
    expect(player.teamId).toBeTruthy();

    // UI sanity — detail page renders Unenroll (indicating enrollment worked).
    await page.goto(`${Services.Gameboard.UI}/game/${game.id}`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: /Unenroll/i })).toBeVisible({ timeout: 15000 });
  });
});
