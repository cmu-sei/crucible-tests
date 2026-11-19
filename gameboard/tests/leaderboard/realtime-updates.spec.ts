// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, type ReadOnlyGame } from '../../fixtures';
import { getAdminToken } from '../../api-helpers';
import { seedScoreboardPlayers, cleanupSeededScoreboard } from '../../db-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

// Simulates a scoreboard update by fetching the scoreboard, inserting another
// seeded row mid-session, then fetching again — the new row should appear.
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

  test('Leaderboard Real-time Updates', async ({ gameboardAuthenticatedPage: page, gbDb: client }) => {
    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      await seedScoreboardPlayers(client, game.id, game.sponsorId, 3);

      const before = await ctx.fetch(`${Services.Gameboard.API}/api/game/${game.id}/score`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const boardBefore = await before.json();
      const teamsBefore = Array.isArray(boardBefore) ? boardBefore : (boardBefore.teams ?? []);
      const countBefore = teamsBefore.length;

      // Add two more players mid-game.
      await seedScoreboardPlayers(client, game.id, game.sponsorId, 2);

      const after = await ctx.fetch(`${Services.Gameboard.API}/api/game/${game.id}/score`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const boardAfter = await after.json();
      const teamsAfter = Array.isArray(boardAfter) ? boardAfter : (boardAfter.teams ?? []);
      expect(teamsAfter.length).toBeGreaterThanOrEqual(countBefore + 2);
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
