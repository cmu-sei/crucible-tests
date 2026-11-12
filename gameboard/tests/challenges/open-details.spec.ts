// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, type SharedWorkspace } from '../../fixtures';
import {
  getAdminToken, createGame, deleteGame, createSponsor, deleteSponsor,
  setAdminSponsor, enrollAdmin, deletePlayer,
  addChallengeSpecToGame, deleteChallengeSpec,
  CreatedGame, CreatedSponsor,
} from '../../api-helpers';
import { seedChallenge } from '../../db-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

test.describe('Challenges', () => {
  let gbToken: string;
  let sponsor: CreatedSponsor, game: CreatedGame, workspace: SharedWorkspace;
  let specId: string, playerId: string, teamId: string, challengeId: string;
  let previousSponsorId = 'other';

  test.beforeEach(async ({ sharedWorkspace, gbDb: client }) => {
    gbToken = await getAdminToken();
    workspace = sharedWorkspace;
    sponsor = await createSponsor(gbToken, `OpenSp-${Date.now()}`);
    ({ previousSponsorId } = await setAdminSponsor(gbToken, sponsor.id));
    game = await createGame(gbToken, { name: `Open-${Date.now()}`, startOffsetDays: -1, endOffsetDays: 30 });
    const spec = await addChallengeSpecToGame(gbToken, game.id, { externalId: workspace.id, name: 'Open Detail' });
    specId = spec.id;
    const player = await enrollAdmin(gbToken, game.id);
    playerId = player.id; teamId = player.teamId;

    const ch = await seedChallenge(client, {
      gameId: game.id, specId, playerId, teamId,
      externalId: workspace.id, name: 'Open Detail', points: 100,
    });
    challengeId = ch.challengeId;
  });

  test.afterEach(async () => {
    if (playerId) await deletePlayer(gbToken, playerId).catch(() => {});
    if (specId) await deleteChallengeSpec(gbToken, specId).catch(() => {});
    if (game) await deleteGame(gbToken, game.id);
    if (previousSponsorId) await setAdminSponsor(gbToken, previousSponsorId).catch(() => {});
    if (sponsor) await deleteSponsor(gbToken, sponsor.id);
  });

  test('Open Challenge Details', async ({ gameboardAuthenticatedPage: page }) => {
    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      const res = await ctx.fetch(`${Services.Gameboard.API}/api/challenge/${challengeId}`, {
        headers: { Authorization: `Bearer ${gbToken}` },
      });
      expect(res.ok(), `status: ${res.status()}`).toBe(true);
      const detail = await res.json();
      expect(detail.id).toBe(challengeId);
      expect(detail.name).toContain('Open Detail');
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
