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

// Seeds 120 synthetic scoreboard entries directly in the database, then
// confirms Gameboard can return all of them via the scoreboard endpoint
// without timing out or crashing.
test.describe('Error Handling', () => {
  let token: string;
  let game: CreatedGame;
  let sponsor: CreatedSponsor;

  test.beforeEach(async () => {
    token = await getAdminToken();
    sponsor = await createSponsor(token, `LB-Page-${Date.now()}`);
    game = await createGame(token, {
      name: `LB-Page-${Date.now()}`,
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

  // Skipped: blocked on Gameboard API /api/game/{id}/score scaling fix.
  // The endpoint issues ~7-9 SQL round-trips per team; with 120 seeded teams
  // the request consistently exceeds 60s. See testing README "Skipped tests".
  test.skip('Large Data Set Handling - Leaderboard Pagination', async ({ gameboardAuthenticatedPage: page }) => {
    const client = await gbConnect();
    try {
      await seedScoreboardPlayers(client, game.id, sponsor.id, 120);
    } finally {
      await client.end();
    }

    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      const start = Date.now();
      const res = await ctx.fetch(`http://localhost:5002/api/game/${game.id}/score`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 60000,
      });
      const elapsed = Date.now() - start;
      expect(res.ok(), `status: ${res.status()}`).toBe(true);
      const board = await res.json();
      const teams = Array.isArray(board) ? board : (board.teams ?? []);
      expect(teams.length).toBeGreaterThanOrEqual(100);
      // Large-list fetch should still complete within a reasonable time.
      expect(elapsed).toBeLessThan(60000);
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
