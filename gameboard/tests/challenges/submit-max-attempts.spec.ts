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
import { seedChallenge, seedChallengeSubmission } from '../../db-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

// Seed multiple submission records against a single challenge to simulate
// reaching max attempts. We verify the submissions count is persisted and
// fetchable via the submissions endpoint.
test.describe('Challenges', () => {
  let gbToken: string;
  let sponsor: CreatedSponsor, game: CreatedGame, workspace: SharedWorkspace;
  let specId: string, playerId: string, teamId: string, challengeId: string;
  let previousSponsorId = 'other';

  test.beforeEach(async ({ sharedWorkspace, gbDb: client }) => {
    gbToken = await getAdminToken();
    workspace = sharedWorkspace;
    sponsor = await createSponsor(gbToken, `Max-${Date.now()}`);
    ({ previousSponsorId } = await setAdminSponsor(gbToken, sponsor.id));
    game = await createGame(gbToken, { name: `Max-${Date.now()}`, startOffsetDays: -1, endOffsetDays: 30 });
    const spec = await addChallengeSpecToGame(gbToken, game.id, { externalId: workspace.id, name: 'Max' });
    specId = spec.id;
    const player = await enrollAdmin(gbToken, game.id);
    playerId = player.id; teamId = player.teamId;

    const ch = await seedChallenge(client, {
      gameId: game.id, specId, playerId, teamId,
      externalId: workspace.id, name: 'Max', points: 100,
    });
    challengeId = ch.challengeId;
    // Record three incorrect attempts.
    await seedChallengeSubmission(client, { challengeId, answer: 'wrong1', score: 0 });
    await seedChallengeSubmission(client, { challengeId, answer: 'wrong2', score: 0 });
    await seedChallengeSubmission(client, { challengeId, answer: 'wrong3', score: 0 });
  });

  test.afterEach(async () => {
    if (playerId) await deletePlayer(gbToken, playerId).catch(() => {});
    if (specId) await deleteChallengeSpec(gbToken, specId).catch(() => {});
    if (game) await deleteGame(gbToken, game.id);
    if (previousSponsorId) await setAdminSponsor(gbToken, previousSponsorId).catch(() => {});
    if (sponsor) await deleteSponsor(gbToken, sponsor.id);
  });

  test('Challenge Answer Submission - Max Attempts Reached', async ({ gameboardAuthenticatedPage: page }) => {
    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      const res = await ctx.fetch(`${Services.Gameboard.API}/api/challenge/${challengeId}/submissions`, {
        headers: { Authorization: `Bearer ${gbToken}` },
      });
      expect(res.ok()).toBe(true);
      const payload = await res.json();
      expect(payload.challengeId).toBe(challengeId);
      expect(Array.isArray(payload.submittedAnswers)).toBe(true);
      expect(payload.submittedAnswers.length).toBeGreaterThanOrEqual(3);
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
