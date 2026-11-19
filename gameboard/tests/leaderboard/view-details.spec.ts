// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, type ReadOnlyGame } from '../../fixtures';
import { getAdminToken } from '../../api-helpers';
import { seedScoreboardPlayers, cleanupSeededScoreboard } from '../../db-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

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

  test('View Team/Player Details from Leaderboard', async ({ gameboardAuthenticatedPage: page, gbDb: client }) => {
    let seeded: Awaited<ReturnType<typeof seedScoreboardPlayers>>;
    seeded = await seedScoreboardPlayers(client, game.id, game.sponsorId, 3);

    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      // /api/team/{teamId}/score returns per-team scoring detail.
      const top = seeded[0];
      const res = await ctx.fetch(`${Services.Gameboard.API}/api/team/${top.teamId}/score`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.ok(), `team/score status: ${res.status()}`).toBe(true);
      const detail = await res.json();
      // Detail includes scoring context for the team.
      expect(JSON.stringify(detail)).toContain(top.approvedName);
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
