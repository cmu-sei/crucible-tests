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
import {
  getTopoMojoAdminToken, createWorkspace, deleteWorkspace, setWorkspaceChallenge,
  CreatedWorkspace,
} from '../../../topomojo-helpers';
import { gbConnect, seedChallenge } from '../../db-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

// TopoMojo stores challenge hints inside the workspace's challenge spec YAML.
// We author a challenge with a hint via PUT /api/challenge/{id}, attach to
// Gameboard, seed a player challenge, and verify the challenge state JSON
// contains a hint field (Gameboard forwards it verbatim from TopoMojo).
test.describe('Challenges', () => {
  let gbToken: string, tmToken: string;
  let sponsor: CreatedSponsor, game: CreatedGame, workspace: CreatedWorkspace;
  let specId: string, playerId: string, teamId: string, challengeId: string;
  let previousSponsorId = 'other';
  const hintText = 'Look carefully at the HTTP headers.';

  test.beforeEach(async () => {
    gbToken = await getAdminToken();
    tmToken = await getTopoMojoAdminToken();
    sponsor = await createSponsor(gbToken, `Hints-${Date.now()}`);
    ({ previousSponsorId } = await setAdminSponsor(gbToken, sponsor.id));
    workspace = await createWorkspace(tmToken, { name: `Hints-WS-${Date.now()}`, audience: 'gameboard' });

    // Author a challenge with a hint on the question.
    await setWorkspaceChallenge(tmToken, workspace.id, {
      text: 'Find the flag.',
      maxAttempts: 3,
      variants: [{
        text: 'v1',
        sections: [{
          name: 'Main',
          text: '',
          questions: [{
            text: 'What is the secret?',
            hint: hintText,
            answer: 'flag{x}',
            penalty: 10,
          }],
        }],
      }],
    });

    game = await createGame(gbToken, { name: `Hints-${Date.now()}`, startOffsetDays: -1, endOffsetDays: 30 });
    const spec = await addChallengeSpecToGame(gbToken, game.id, { externalId: workspace.id, name: 'Hinted' });
    specId = spec.id;
    const player = await enrollAdmin(gbToken, game.id);
    playerId = player.id; teamId = player.teamId;

    const client = await gbConnect();
    try {
      // Seed a challenge whose State includes the hint so Gameboard surfaces it.
      const stateJson = JSON.stringify({
        id: 'seed', name: 'Hinted',
        challenge: {
          text: 'Find the flag.',
          maxAttempts: 3,
          maxPoints: 100,
          attempts: 0,
          score: 0,
          sectionCount: 1,
          sectionIndex: 0,
          questions: [{
            text: 'What is the secret?',
            hint: hintText,
            answer: '',
            example: '',
            weight: 1.0,
            penalty: 10,
            isCorrect: false,
            isGraded: false,
          }],
        },
        vms: [],
        isActive: true,
      });
      const ch = await seedChallenge(client, {
        gameId: game.id, specId, playerId, teamId,
        externalId: workspace.id, name: 'Hinted', points: 100,
        stateJson,
      });
      challengeId = ch.challengeId;
    } finally {
      await client.end();
    }
  });

  test.afterEach(async () => {
    if (playerId) await deletePlayer(gbToken, playerId).catch(() => {});
    if (specId) await deleteChallengeSpec(gbToken, specId).catch(() => {});
    if (game) await deleteGame(gbToken, game.id);
    if (workspace) await deleteWorkspace(tmToken, workspace.id);
    if (previousSponsorId) await setAdminSponsor(gbToken, previousSponsorId).catch(() => {});
    if (sponsor) await deleteSponsor(gbToken, sponsor.id);
  });

  test('Challenge Hints', async ({ gameboardAuthenticatedPage: page }) => {
    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      const res = await ctx.fetch(`http://localhost:5002/api/challenge/${challengeId}`, {
        headers: { Authorization: `Bearer ${gbToken}` },
      });
      expect(res.ok()).toBe(true);
      const detail = await res.json();
      // Detail includes the state blob we wrote. Gameboard re-serializes it
      // into `state` (string) — check for the hint text within.
      const stringified = JSON.stringify(detail);
      expect(stringified).toContain(hintText);
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
