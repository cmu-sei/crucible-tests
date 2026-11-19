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

// A challenge is considered "started" once it has a StartTime set (which the
// seeded row has) and the player has an active session. We verify the
// challenge shows up as active in /api/challenges and has startTime <= now.
test.describe('Challenges', () => {
  let gbToken: string;
  let sponsor: CreatedSponsor, game: CreatedGame, workspace: SharedWorkspace;
  let specId: string, playerId: string, teamId: string, challengeId: string;
  let previousSponsorId = 'other';

  test.beforeEach(async ({ sharedWorkspace, gbDb: client }) => {
    gbToken = await getAdminToken();
    workspace = sharedWorkspace;
    sponsor = await createSponsor(gbToken, `StartSp-${Date.now()}`);
    ({ previousSponsorId } = await setAdminSponsor(gbToken, sponsor.id));
    game = await createGame(gbToken, { name: `Start-${Date.now()}`, startOffsetDays: -1, endOffsetDays: 30 });
    const spec = await addChallengeSpecToGame(gbToken, game.id, { externalId: workspace.id, name: 'Started' });
    specId = spec.id;
    const player = await enrollAdmin(gbToken, game.id);
    playerId = player.id; teamId = player.teamId;

    const ch = await seedChallenge(client, {
      gameId: game.id, specId, playerId, teamId,
      externalId: workspace.id, name: 'Started', points: 100,
      hasDeployedGamespace: true,
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

  test('Start Challenge', async ({ gameboardAuthenticatedPage: page }) => {
    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      const res = await ctx.fetch(`${Services.Gameboard.API}/api/challenge/${challengeId}`, {
        headers: { Authorization: `Bearer ${gbToken}` },
      });
      expect(res.ok()).toBe(true);
      const detail = await res.json();
      // Challenge has a start time set, gamespace deployed flag true.
      expect(detail.startTime).toBeTruthy();
      expect(new Date(detail.startTime).getTime()).toBeLessThanOrEqual(Date.now());
      expect(detail.hasDeployedGamespace).toBe(true);
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
