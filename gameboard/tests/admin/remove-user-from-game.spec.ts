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
} from '../../api-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

test.describe('Admin - Users', () => {
  let token: string;
  let game: CreatedGame;
  let sponsor: CreatedSponsor;
  let playerId: string | null = null;
  let previousSponsorId = 'other';

  test.beforeEach(async () => {
    token = await getAdminToken();
    sponsor = await createSponsor(token);
    ({ previousSponsorId } = await setAdminSponsor(token, sponsor.id));
    game = await createGame(token, {
      name: `RemoveUser-${Date.now()}`,
      startOffsetDays: -1,
      endOffsetDays: 30,
    });
    const player = await enrollAdmin(token, game.id);
    playerId = player.id;
  });

  test.afterEach(async () => {
    if (playerId) await deletePlayer(token, playerId).catch(() => {});
    if (game) await deleteGame(token, game.id);
    if (previousSponsorId && token) await setAdminSponsor(token, previousSponsorId).catch(() => {});
    if (sponsor) await deleteSponsor(token, sponsor.id);
  });

  test('Remove User from Game', async ({ gameboardAuthenticatedPage: page }) => {
    // Verify enrollment exists.
    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      const before = await ctx.fetch(`http://localhost:5002/api/players`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const beforeList = await before.json();
      expect(beforeList.some((p: any) => p.id === playerId)).toBe(true);

      // Remove via DELETE.
      await deletePlayer(token, playerId!);

      const after = await ctx.fetch(`http://localhost:5002/api/players`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const afterList = await after.json();
      expect(afterList.some((p: any) => p.id === playerId)).toBe(false);
      playerId = null; // prevent double-delete
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
