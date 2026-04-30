// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import {
  getAdminToken, createGame, deleteGame, createSponsor, deleteSponsor,
  setAdminSponsor, enrollAdmin, deletePlayer,
  addChallengeSpecToGame, deleteChallengeSpec,
  CreatedGame, CreatedSponsor,
} from '../../api-helpers';
import { getTopoMojoAdminToken, createWorkspace, deleteWorkspace, CreatedWorkspace } from '../../../topomojo-helpers';
import { gbConnect, seedChallenge } from '../../db-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

// Seed 20 challenges then benchmark the /api/challenges endpoint.
test.describe('Performance', () => {
  let gbToken: string, tmToken: string;
  let sponsor: CreatedSponsor, game: CreatedGame, workspace: CreatedWorkspace;
  let specId: string, playerId: string, teamId: string;
  let previousSponsorId = 'other';

  test.beforeEach(async () => {
    gbToken = await getAdminToken();
    tmToken = await getTopoMojoAdminToken();
    sponsor = await createSponsor(gbToken, `CBL-${Date.now()}`);
    ({ previousSponsorId } = await setAdminSponsor(gbToken, sponsor.id));
    workspace = await createWorkspace(tmToken, { name: `CBL-WS-${Date.now()}`, audience: 'gameboard' });
    game = await createGame(gbToken, { name: `CBL-${Date.now()}`, startOffsetDays: -1, endOffsetDays: 30 });
    const spec = await addChallengeSpecToGame(gbToken, game.id, { externalId: workspace.id, name: 'CBL' });
    specId = spec.id;
    const player = await enrollAdmin(gbToken, game.id);
    playerId = player.id; teamId = player.teamId;
  });

  test.afterEach(async () => {
    if (playerId) await deletePlayer(gbToken, playerId).catch(() => {});
    if (specId) await deleteChallengeSpec(gbToken, specId).catch(() => {});
    if (game) await deleteGame(gbToken, game.id);
    if (workspace) await deleteWorkspace(tmToken, workspace.id);
    if (previousSponsorId) await setAdminSponsor(gbToken, previousSponsorId).catch(() => {});
    if (sponsor) await deleteSponsor(gbToken, sponsor.id);
  });

  test('Page Load Performance - Challenge Board', async ({ gameboardAuthenticatedPage: page }) => {
    const client = await gbConnect();
    try {
      for (let i = 0; i < 20; i++) {
        await seedChallenge(client, {
          gameId: game.id, specId, playerId, teamId,
          externalId: workspace.id, name: `CBL-${i}`, points: 100,
          completed: i % 3 === 0,
        });
      }
    } finally {
      await client.end();
    }

    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      // Warm-up.
      await ctx.fetch(`http://localhost:5002/api/challenges?gid=${game.id}`, {
        headers: { Authorization: `Bearer ${gbToken}` },
      });
      const start = Date.now();
      const res = await ctx.fetch(`http://localhost:5002/api/challenges?gid=${game.id}`, {
        headers: { Authorization: `Bearer ${gbToken}` },
      });
      const elapsed = Date.now() - start;
      expect(res.ok()).toBe(true);
      expect(elapsed).toBeLessThan(10000);
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
