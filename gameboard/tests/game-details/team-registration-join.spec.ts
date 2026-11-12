// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, resetGameboardPoolUser, GameboardPoolUser } from '../../fixtures';
import {
  getAdminToken,
  createGame,
  deleteGame,
  createSponsor,
  deleteSponsor,
  deletePlayer,
  provisionGameboardUser,
  enrollUser,
  generateTeamInvite,
  redeemTeamInvite,
  CreatedGame,
  CreatedSponsor,
  CreatedPlayer,
} from '../../api-helpers';
import { getUserToken } from '../../../keycloak-admin';

test.describe('Game Details and Registration', () => {
  let gbAdmin: string;
  let sponsor: CreatedSponsor;
  let game: CreatedGame;
  let captain: { user: GameboardPoolUser; player: CreatedPlayer; token: string };
  let joiner: { user: GameboardPoolUser; player: CreatedPlayer; token: string } | null = null;

  test.beforeEach(async ({ nonAdminUsers }) => {
    gbAdmin = await getAdminToken();
    sponsor = await createSponsor(gbAdmin, `Join-${Date.now()}`);
    game = await createGame(gbAdmin, {
      name: `Join-${Date.now()}`,
      maxTeamSize: 4,
      startOffsetDays: -1,
      endOffsetDays: 30,
    });
    const cu = nonAdminUsers[0];
    const ct = await getUserToken(cu.username, cu.password);
    await provisionGameboardUser(ct, sponsor.id);
    const cp = await enrollUser(ct, cu.userId, game.id);
    captain = { user: cu, player: cp, token: ct };
  });

  test.afterEach(async ({ nonAdminUsers }) => {
    // Non-captains first: Gameboard refuses to delete a team's manager while it has members.
    if (joiner) await deletePlayer(gbAdmin, joiner.player.id).catch(() => {});
    joiner = null;
    if (captain) await deletePlayer(gbAdmin, captain.player.id).catch(() => {});
    // Pool users outlive the test: put back the sponsor they were moved onto (before
    // that sponsor is deleted) and any role, after their players are gone.
    for (const user of nonAdminUsers) await resetGameboardPoolUser(user);
    if (game) await deleteGame(gbAdmin, game.id);
    if (sponsor) await deleteSponsor(gbAdmin, sponsor.id);
  });

  test('Team Registration - Join Existing Team', async ({ gameboardAuthenticatedPage: page, nonAdminUsers }) => {
    const code = await generateTeamInvite(captain.token, captain.player.id);

    const ju = nonAdminUsers[1];
    const jt = await getUserToken(ju.username, ju.password);
    await provisionGameboardUser(jt, sponsor.id);
    const jpInit = await enrollUser(jt, ju.userId, game.id);
    const jp = await redeemTeamInvite(jt, jpInit.id, code);
    joiner = { user: ju, player: jp, token: jt };

    expect(jp.teamId).toBe(captain.player.teamId);

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
