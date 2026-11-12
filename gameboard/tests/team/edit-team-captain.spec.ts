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
  updatePlayer,
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

  test.beforeEach(async ({ nonAdminUsers }) => {
    gbAdmin = await getAdminToken();
    sponsor = await createSponsor(gbAdmin, `EditCap-${Date.now()}`);
    game = await createGame(gbAdmin, {
      name: `EditCap-${Date.now()}`,
      maxTeamSize: 4,
      startOffsetDays: -1,
      endOffsetDays: 30,
    });
    const u = nonAdminUsers[0];
    const tk = await getUserToken(u.username, u.password);
    await provisionGameboardUser(tk, sponsor.id);
    const p = await enrollUser(tk, u.userId, game.id);
    captain = { user: u, player: p, token: tk };
  });

  test.afterEach(async ({ nonAdminUsers }) => {
    if (captain) await deletePlayer(gbAdmin, captain.player.id).catch(() => {});
    // Pool users outlive the test: put back the sponsor they were moved onto (before
    // that sponsor is deleted) and any role, after their players are gone.
    for (const user of nonAdminUsers) await resetGameboardPoolUser(user);
    if (game) await deleteGame(gbAdmin, game.id);
    if (sponsor) await deleteSponsor(gbAdmin, sponsor.id);
  });

  test('Edit Team Details - Team Captain', async ({ gameboardAuthenticatedPage: page }) => {
    const newName = `Captain Team ${Date.now()}`;
    await updatePlayer(captain.token, captain.player.id, { name: newName });

    const after = await getPlayer(gbAdmin, captain.player.id);
    expect(after.name).toBe(newName);

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
