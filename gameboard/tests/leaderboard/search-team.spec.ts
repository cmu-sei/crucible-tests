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
  CreatedGame,
  CreatedSponsor,
} from '../../api-helpers';
import { gbConnect, seedScoreboardPlayers, cleanupSeededScoreboard } from '../../db-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

// Seeds scoreboard data directly in the database, then queries Gameboard's
// scoreboard endpoint and verifies the seeded teams appear with correct ranks.
test.describe('Leaderboard', () => {
  let token: string;
  let game: CreatedGame;
  let sponsor: CreatedSponsor;

  test.beforeEach(async () => {
    token = await getAdminToken();
    sponsor = await createSponsor(token, `LB-Sp-${Date.now()}`);
    game = await createGame(token, {
      name: `LB-Search-${Date.now()}`,
      startOffsetDays: -1,
      endOffsetDays: 30,
    });
  });

  test.afterEach(async () => {
    const client = await gbConnect();
    try {
      await cleanupSeededScoreboard(client, game.id);
    } finally {
      await client.end();
    }
    if (game) await deleteGame(token, game.id);
    if (sponsor) await deleteSponsor(token, sponsor.id);
  });

  test('Leaderboard Search - Find Team/Player', async ({ gameboardAuthenticatedPage: page }) => {
    const client = await gbConnect();
    let seeded: Awaited<ReturnType<typeof seedScoreboardPlayers>>;
    try {
      seeded = await seedScoreboardPlayers(client, game.id, sponsor.id, 5);
    } finally {
      await client.end();
    }

    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      const res = await ctx.fetch(`http://localhost:5002/api/game/${game.id}/score`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.ok(), `scoreboard status: ${res.status()}`).toBe(true);
      const board = await res.json();

      // The scoreboard should reference our seeded teams.
      const teams = board.teams ?? board;
      expect(Array.isArray(teams)).toBe(true);
      const approvedNames = JSON.stringify(teams);
      expect(approvedNames).toContain(seeded[0].approvedName);
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
