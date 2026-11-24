// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, type ReadOnlyGame } from '../../fixtures';
import { getAdminToken } from '../../api-helpers';
import { seedScoreboardPlayers, cleanupSeededScoreboard } from '../../db-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

// Score history for a team is exposed via /api/team/{teamId}/score. A seeded
// player with non-zero score produces a scoring record.
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

  test('Score History and Timeline', async ({ gameboardAuthenticatedPage: page, gbDb: client }) => {
    let seeded: Awaited<ReturnType<typeof seedScoreboardPlayers>>;
    seeded = await seedScoreboardPlayers(client, game.id, game.sponsorId, 2);

    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      const res = await ctx.fetch(`${Services.Gameboard.API}/api/team/${seeded[0].teamId}/score`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.ok()).toBe(true);
      const detail = await res.json();
      // The detail includes score totals (non-zero because we seeded 1000 pts).
      const stringified = JSON.stringify(detail);
      expect(stringified).toContain(seeded[0].approvedName);
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
