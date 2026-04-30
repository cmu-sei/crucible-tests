// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import {
  getAdminToken, createGame, deleteGame, createSponsor, deleteSponsor,
  setAdminSponsor, enrollAdmin, deletePlayer,
  CreatedGame, CreatedSponsor,
} from '../../api-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

// Gameboard's Admin → Game Center Teams/Players tab offers a CSV export.
// The underlying endpoint is GET /api/admin/games/{gameId}/players/export.
test.describe('Admin - Users', () => {
  let token: string;
  let sponsor: CreatedSponsor;
  let game: CreatedGame;
  let playerId: string | null = null;
  let previousSponsorId = 'other';

  test.beforeEach(async () => {
    token = await getAdminToken();
    sponsor = await createSponsor(token, `Exp-${Date.now()}`);
    ({ previousSponsorId } = await setAdminSponsor(token, sponsor.id));
    game = await createGame(token, {
      name: `Exp-${Date.now()}`,
      startOffsetDays: -1,
      endOffsetDays: 30,
    });
    const p = await enrollAdmin(token, game.id);
    playerId = p.id;
  });

  test.afterEach(async () => {
    if (playerId) await deletePlayer(token, playerId).catch(() => {});
    if (game) await deleteGame(token, game.id);
    if (previousSponsorId) await setAdminSponsor(token, previousSponsorId).catch(() => {});
    if (sponsor) await deleteSponsor(token, sponsor.id);
  });

  test('Export Participant Data', async ({ gameboardAuthenticatedPage: page }) => {
    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      const res = await ctx.fetch(
        `http://localhost:5002/api/admin/games/${game.id}/players/export?teamIds=`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      expect(res.ok(), `status: ${res.status()}`).toBe(true);
      const body = await res.json();
      // Response shape: GetPlayersCsvExportResponse with a downloadable link or inline CSV.
      expect(body).toBeTruthy();
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
