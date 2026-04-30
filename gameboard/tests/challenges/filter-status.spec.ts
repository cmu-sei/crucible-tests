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

// Seed 2 challenges — one completed, one in-progress. Verify the admin
// challenges listing returns both and we can distinguish by score.
test.describe('Challenges', () => {
  let gbToken: string, tmToken: string;
  let sponsor: CreatedSponsor, game: CreatedGame, workspace: CreatedWorkspace;
  let specId: string, playerId: string, teamId: string;
  let previousSponsorId = 'other';

  test.beforeEach(async () => {
    gbToken = await getAdminToken();
    tmToken = await getTopoMojoAdminToken();
    sponsor = await createSponsor(gbToken, `FS-${Date.now()}`);
    ({ previousSponsorId } = await setAdminSponsor(gbToken, sponsor.id));
    workspace = await createWorkspace(tmToken, { name: `FS-WS-${Date.now()}`, audience: 'gameboard' });
    game = await createGame(gbToken, { name: `FS-${Date.now()}`, startOffsetDays: -1, endOffsetDays: 30 });
    const spec = await addChallengeSpecToGame(gbToken, game.id, { externalId: workspace.id, name: 'Filter' });
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

  test('Challenge Filtering - By Completion Status', async ({ gameboardAuthenticatedPage: page }) => {
    const client = await gbConnect();
    try {
      await seedChallenge(client, {
        gameId: game.id, specId, playerId, teamId,
        externalId: workspace.id, name: 'Completed', points: 100, completed: true,
      });
      await seedChallenge(client, {
        gameId: game.id, specId, playerId, teamId,
        externalId: workspace.id, name: 'InProgress', points: 100, score: 0,
      });
    } finally {
      await client.end();
    }

    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      const res = await ctx.fetch(`http://localhost:5002/api/challenges?gid=${game.id}`, {
        headers: { Authorization: `Bearer ${gbToken}` },
      });
      expect(res.ok()).toBe(true);
      const list: any[] = await res.json();
      // /api/challenges does not filter by gid server-side (the endpoint only
      // honors Term/Skip/Take), and ChallengeSummary exposes gameName rather
      // than gameId, so narrow to our game by its unique generated name.
      const forThisGame = list.filter(c => c.gameName === game.name);
      const completed = forThisGame.filter(c => (c.score ?? 0) >= 100);
      const inProgress = forThisGame.filter(c => (c.score ?? 0) < 100);
      expect(completed.length).toBe(1);
      expect(inProgress.length).toBe(1);
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
