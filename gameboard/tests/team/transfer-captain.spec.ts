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
  promoteToCaptain,
  getPlayer,
  CreatedGame,
  CreatedSponsor,
  CreatedPlayer,
} from '../../api-helpers';
import { getUserToken } from '../../../keycloak-admin';

test.describe('Team Management', () => {
  let gbAdmin: string;
  let sponsor: CreatedSponsor;
  let game: CreatedGame;
  let captain: { user: GameboardPoolUser; player: CreatedPlayer; token: string };
  let member: { user: GameboardPoolUser; player: CreatedPlayer; token: string };

  test.beforeEach(async ({ nonAdminUsers }) => {
    gbAdmin = await getAdminToken();
    sponsor = await createSponsor(gbAdmin, `XferCap-${Date.now()}`);
    game = await createGame(gbAdmin, {
      name: `XferCap-${Date.now()}`,
      maxTeamSize: 4,
      startOffsetDays: -1,
      endOffsetDays: 30,
    });

    const cu = nonAdminUsers[0];
    const ct = await getUserToken(cu.username, cu.password);
    await provisionGameboardUser(ct, sponsor.id);
    const cp = await enrollUser(ct, cu.userId, game.id);
    captain = { user: cu, player: cp, token: ct };

    const mu = nonAdminUsers[1];
    const mt = await getUserToken(mu.username, mu.password);
    await provisionGameboardUser(mt, sponsor.id);
    const mpInit = await enrollUser(mt, mu.userId, game.id);
    const code = await generateTeamInvite(ct, cp.id);
    const mp = await redeemTeamInvite(mt, mpInit.id, code);
    member = { user: mu, player: mp, token: mt };
  });

  test.afterEach(async ({ nonAdminUsers }) => {
    // Non-captains first: Gameboard refuses to delete a team's manager while it has members.
    if (member) await deletePlayer(gbAdmin, member.player.id).catch(() => {});
    if (captain) await deletePlayer(gbAdmin, captain.player.id).catch(() => {});
    // Pool users outlive the test: put back the sponsor they were moved onto (before
    // that sponsor is deleted) and any role, after their players are gone.
    for (const user of nonAdminUsers) await resetGameboardPoolUser(user);
    if (game) await deleteGame(gbAdmin, game.id);
    if (sponsor) await deleteSponsor(gbAdmin, sponsor.id);
  });

  test('Transfer Team Captain Role', async ({ gameboardAuthenticatedPage: page }) => {
    await promoteToCaptain(captain.token, captain.player.teamId, member.player.id, captain.player.id);

    const capAfter = await getPlayer(gbAdmin, captain.player.id);
    const memAfter = await getPlayer(gbAdmin, member.player.id);
    expect(memAfter.role?.toLowerCase()).toBe('manager');
    expect(capAfter.role?.toLowerCase()).toBe('member');

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
