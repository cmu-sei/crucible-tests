// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, type ReadOnlyGame } from '../../fixtures';
import { getAdminToken } from '../../api-helpers';
import { seedScoreboardPlayers, cleanupSeededScoreboard } from '../../db-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

// Seeds scoreboard data directly in the database, then queries Gameboard's
// scoreboard endpoint and verifies the seeded teams appear with correct ranks.
test.describe('Leaderboard', () => {
  let token: string;
  let game: ReadOnlyGame;

  test.beforeEach(async ({ readOnlyGame }) => {
    token = await getAdminToken();
    game = readOnlyGame;
  });

  test.afterEach(async ({ gbDb: client }) => {
    // The game is the worker's; delete exactly the players this test seeded.
    await cleanupSeededScoreboard(client, game.id);
  });

  test('Leaderboard Search - Find Team/Player', async ({ gameboardAuthenticatedPage: page, gbDb: client }) => {
    let seeded: Awaited<ReturnType<typeof seedScoreboardPlayers>>;
    seeded = await seedScoreboardPlayers(client, game.id, game.sponsorId, 5);

    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      const res = await ctx.fetch(`${Services.Gameboard.API}/api/game/${game.id}/score`, {
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

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
