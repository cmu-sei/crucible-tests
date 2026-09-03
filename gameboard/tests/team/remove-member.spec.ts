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
  deletePlayer,
  provisionGameboardUser,
  enrollUser,
  generateTeamInvite,
  redeemTeamInvite,
  listGamePlayers,
  CreatedGame,
  CreatedSponsor,
  CreatedPlayer,
} from '../../api-helpers';
import {
  getKeycloakAdminToken,
  createKeycloakUser,
  deleteKeycloakUser,
  tempUsername,
  getUserToken,
  KeycloakUser,
} from '../../../keycloak-admin';

test.describe('Team Management', () => {
  let gbAdmin: string;
  let kcAdmin: string;
  let sponsor: CreatedSponsor;
  let game: CreatedGame;
  let captain: { user: KeycloakUser; player: CreatedPlayer; token: string };
  let member: { user: KeycloakUser; player: CreatedPlayer; token: string } | null;

  test.beforeEach(async () => {
    gbAdmin = await getAdminToken();
    kcAdmin = await getKeycloakAdminToken();
    sponsor = await createSponsor(gbAdmin, `Remove-${Date.now()}`);
    game = await createGame(gbAdmin, {
      name: `Remove-${Date.now()}`,
      maxTeamSize: 4,
      startOffsetDays: -1,
      endOffsetDays: 30,
    });

    const cu = await createKeycloakUser(kcAdmin, { username: tempUsername('cap'), password: 'pw' });
    const ct = await getUserToken(cu.username, 'pw');
    await provisionGameboardUser(ct, sponsor.id);
    const cp = await enrollUser(ct, cu.id, game.id);
    captain = { user: cu, player: cp, token: ct };

    const mu = await createKeycloakUser(kcAdmin, { username: tempUsername('mbr'), password: 'pw' });
    const mt = await getUserToken(mu.username, 'pw');
    await provisionGameboardUser(mt, sponsor.id);
    const mpInit = await enrollUser(mt, mu.id, game.id);
    const code = await generateTeamInvite(ct, cp.id);
    const mp = await redeemTeamInvite(mt, mpInit.id, code);
    member = { user: mu, player: mp, token: mt };
  });

  test.afterEach(async () => {
    if (captain) await deletePlayer(gbAdmin, captain.player.id).catch(() => {});
    if (member) await deletePlayer(gbAdmin, member.player.id).catch(() => {});
    if (game) await deleteGame(gbAdmin, game.id);
    if (sponsor) await deleteSponsor(gbAdmin, sponsor.id);
    if (captain) await deleteKeycloakUser(kcAdmin, captain.user.id);
    if (member) await deleteKeycloakUser(kcAdmin, member.user.id);
  });

  test('Remove Team Member - Captain/Admin', async ({ gameboardAuthenticatedPage: page }) => {
    // Admin removes the team member.
    await deletePlayer(gbAdmin, member!.player.id);
    member = null;

    const after = await listGamePlayers(gbAdmin, game.id, captain.player.teamId);
    expect(after.length).toBe(1);
    expect(after[0].id).toBe(captain.player.id);

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
