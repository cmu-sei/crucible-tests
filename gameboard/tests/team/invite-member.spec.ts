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

  test.beforeEach(async () => {
    gbAdmin = await getAdminToken();
    kcAdmin = await getKeycloakAdminToken();
    sponsor = await createSponsor(gbAdmin, `Invite-${Date.now()}`);
    game = await createGame(gbAdmin, {
      name: `Invite-${Date.now()}`,
      maxTeamSize: 4,
      startOffsetDays: -1,
      endOffsetDays: 30,
    });
    const u = await createKeycloakUser(kcAdmin, { username: tempUsername('cap'), password: 'pw' });
    const tk = await getUserToken(u.username, 'pw');
    await provisionGameboardUser(tk, sponsor.id);
    const p = await enrollUser(tk, u.id, game.id);
    captain = { user: u, player: p, token: tk };
  });

  test.afterEach(async () => {
    if (captain) await deletePlayer(gbAdmin, captain.player.id).catch(() => {});
    if (game) await deleteGame(gbAdmin, game.id);
    if (sponsor) await deleteSponsor(gbAdmin, sponsor.id);
    if (captain) await deleteKeycloakUser(kcAdmin, captain.user.id);
  });

  test('Invite Team Member', async ({ gameboardAuthenticatedPage: page }) => {
    const code = await generateTeamInvite(captain.token, captain.player.id);
    expect(code).toBeTruthy();
    expect(code.length).toBeGreaterThan(0);

    // Re-generate — should issue a fresh code.
    const newCode = await generateTeamInvite(captain.token, captain.player.id);
    expect(newCode).toBeTruthy();

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
