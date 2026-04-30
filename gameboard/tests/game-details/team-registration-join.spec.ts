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

test.describe('Game Details and Registration', () => {
  let gbAdmin: string;
  let kcAdmin: string;
  let sponsor: CreatedSponsor;
  let game: CreatedGame;
  let captain: { user: KeycloakUser; player: CreatedPlayer; token: string };
  let joiner: { user: KeycloakUser; player: CreatedPlayer; token: string } | null = null;

  test.beforeEach(async () => {
    gbAdmin = await getAdminToken();
    kcAdmin = await getKeycloakAdminToken();
    sponsor = await createSponsor(gbAdmin, `Join-${Date.now()}`);
    game = await createGame(gbAdmin, {
      name: `Join-${Date.now()}`,
      maxTeamSize: 4,
      startOffsetDays: -1,
      endOffsetDays: 30,
    });
    const cu = await createKeycloakUser(kcAdmin, { username: tempUsername('cap'), password: 'pw' });
    const ct = await getUserToken(cu.username, 'pw');
    await provisionGameboardUser(ct, sponsor.id);
    const cp = await enrollUser(ct, cu.id, game.id);
    captain = { user: cu, player: cp, token: ct };
  });

  test.afterEach(async () => {
    if (captain) await deletePlayer(gbAdmin, captain.player.id).catch(() => {});
    if (joiner) await deletePlayer(gbAdmin, joiner.player.id).catch(() => {});
    if (game) await deleteGame(gbAdmin, game.id);
    if (sponsor) await deleteSponsor(gbAdmin, sponsor.id);
    if (captain) await deleteKeycloakUser(kcAdmin, captain.user.id);
    if (joiner) await deleteKeycloakUser(kcAdmin, joiner.user.id);
  });

  test('Team Registration - Join Existing Team', async ({ gameboardAuthenticatedPage: page }) => {
    const code = await generateTeamInvite(captain.token, captain.player.id);

    const ju = await createKeycloakUser(kcAdmin, { username: tempUsername('jnr'), password: 'pw' });
    const jt = await getUserToken(ju.username, 'pw');
    await provisionGameboardUser(jt, sponsor.id);
    const jpInit = await enrollUser(jt, ju.id, game.id);
    const jp = await redeemTeamInvite(jt, jpInit.id, code);
    joiner = { user: ju, player: jp, token: jt };

    expect(jp.teamId).toBe(captain.player.teamId);

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
