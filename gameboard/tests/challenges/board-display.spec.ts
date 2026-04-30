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
  setAdminSponsor,
  enrollAdmin,
  deletePlayer,
  addChallengeSpecToGame,
  deleteChallengeSpec,
  CreatedGame,
  CreatedSponsor,
} from '../../api-helpers';
import {
  getTopoMojoAdminToken,
  createWorkspace,
  deleteWorkspace,
  CreatedWorkspace,
} from '../../../topomojo-helpers';
import { gbConnect, seedChallenge } from '../../db-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

// Full challenge-board flow: workspace in TopoMojo → spec in game → player
// enrolled → challenge row seeded in DB. The challenge then appears in
// /api/challenges.
test.describe('Challenges', () => {
  let gbToken: string;
  let tmToken: string;
  let sponsor: CreatedSponsor;
  let game: CreatedGame;
  let workspace: CreatedWorkspace;
  let specId: string;
  let playerId: string;
  let teamId: string;
  let previousSponsorId = 'other';

  test.beforeEach(async () => {
    gbToken = await getAdminToken();
    tmToken = await getTopoMojoAdminToken();
    sponsor = await createSponsor(gbToken, `BoardSp-${Date.now()}`);
    ({ previousSponsorId } = await setAdminSponsor(gbToken, sponsor.id));
    workspace = await createWorkspace(tmToken, { name: `Board-WS-${Date.now()}`, audience: 'gameboard' });
    game = await createGame(gbToken, { name: `Board-${Date.now()}`, startOffsetDays: -1, endOffsetDays: 30 });
    const spec = await addChallengeSpecToGame(gbToken, game.id, { externalId: workspace.id, name: 'Board Challenge' });
    specId = spec.id;
    const player = await enrollAdmin(gbToken, game.id);
    playerId = player.id;
    teamId = player.teamId;
  });

  test.afterEach(async () => {
    if (playerId) await deletePlayer(gbToken, playerId).catch(() => {});
    if (specId) await deleteChallengeSpec(gbToken, specId).catch(() => {});
    if (game) await deleteGame(gbToken, game.id);
    if (workspace) await deleteWorkspace(tmToken, workspace.id);
    if (previousSponsorId) await setAdminSponsor(gbToken, previousSponsorId).catch(() => {});
    if (sponsor) await deleteSponsor(gbToken, sponsor.id);
  });

  test('Challenge Board Display', async ({ gameboardAuthenticatedPage: page }) => {
    const client = await gbConnect();
    try {
      await seedChallenge(client, {
        gameId: game.id, specId, playerId, teamId,
        externalId: workspace.id, name: 'Board Challenge', points: 100,
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
      // /api/challenges does not filter by gid server-side, and ChallengeSummary
      // exposes gameName rather than gameId — narrow by the unique generated name.
      const forThisGame = list.filter(c => c.gameName === game.name);
      expect(forThisGame.length).toBeGreaterThanOrEqual(1);
      expect(forThisGame[0].gameName).toBe(game.name);
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
