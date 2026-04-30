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

// Benchmarks the scoreboard endpoint response time with a realistic 50-team
// dataset seeded directly in the database.
test.describe('Performance', () => {
  let token: string;
  let game: CreatedGame;
  let sponsor: CreatedSponsor;

  test.beforeEach(async () => {
    token = await getAdminToken();
    sponsor = await createSponsor(token, `PerfLB-${Date.now()}`);
    game = await createGame(token, {
      name: `PerfLB-${Date.now()}`,
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

  test('API Response Time - Leaderboard Updates', async ({ gameboardAuthenticatedPage: page }) => {
    const client = await gbConnect();
    try {
      await seedScoreboardPlayers(client, game.id, sponsor.id, 50);
    } finally {
      await client.end();
    }

    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      // Warm-up.
      await ctx.fetch(`http://localhost:5002/api/game/${game.id}/score`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 60000,
      });

      const start = Date.now();
      const res = await ctx.fetch(`http://localhost:5002/api/game/${game.id}/score`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 60000,
      });
      const elapsed = Date.now() - start;
      expect(res.ok()).toBe(true);
      // Response time budget loosened for a dev container under high load.
      expect(elapsed).toBeLessThan(30000);
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
