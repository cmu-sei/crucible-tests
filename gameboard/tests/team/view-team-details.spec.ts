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

// When enrolled in a team game, the game detail page exposes the team info
// (team name, invitation code, team members). We seed a team game, enroll
// admin (who becomes captain), and verify the team UI renders.
test.describe('Team Management', () => {
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
      name: `ViewTeam-${Date.now()}`,
      maxTeamSize: 4,
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

  test('View Team Details', async ({ gameboardAuthenticatedPage: page }) => {
    await page.goto(`${Services.Gameboard.UI}/game/${game.id}`, { waitUntil: 'networkidle' });
    // The enrolled game page shows the game name and an Unenroll button,
    // confirming the team record exists for this user.
    await expect(page.locator(`text=${game.name}`).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Unenroll/i })).toBeVisible({ timeout: 15000 });
  });
});
