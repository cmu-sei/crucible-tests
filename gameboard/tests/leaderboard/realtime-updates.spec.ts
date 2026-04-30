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

// Simulates a scoreboard update by fetching the scoreboard, inserting another
// seeded row mid-session, then fetching again — the new row should appear.
test.describe('Leaderboard', () => {
  let token: string;
  let game: CreatedGame;
  let sponsor: CreatedSponsor;

  test.beforeEach(async () => {
    token = await getAdminToken();
    sponsor = await createSponsor(token, `LB-RT-${Date.now()}`);
    game = await createGame(token, {
      name: `LB-RT-${Date.now()}`,
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

  test('Leaderboard Real-time Updates', async ({ gameboardAuthenticatedPage: page }) => {
    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    const client = await gbConnect();
    try {
      await seedScoreboardPlayers(client, game.id, sponsor.id, 3);

      const before = await ctx.fetch(`http://localhost:5002/api/game/${game.id}/score`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const boardBefore = await before.json();
      const teamsBefore = Array.isArray(boardBefore) ? boardBefore : (boardBefore.teams ?? []);
      const countBefore = teamsBefore.length;

      // Add two more players mid-game.
      await seedScoreboardPlayers(client, game.id, sponsor.id, 2);

      const after = await ctx.fetch(`http://localhost:5002/api/game/${game.id}/score`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const boardAfter = await after.json();
      const teamsAfter = Array.isArray(boardAfter) ? boardAfter : (boardAfter.teams ?? []);
      expect(teamsAfter.length).toBeGreaterThanOrEqual(countBefore + 2);
    } finally {
      await client.end();
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
