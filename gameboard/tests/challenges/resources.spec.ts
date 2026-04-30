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

// Challenge resources (files, VMs) are referenced via the challenge State
// JSON's `vms` array. We seed a challenge with one VM descriptor and verify
// Gameboard echoes it in the challenge detail response.
test.describe('Challenges', () => {
  let gbToken: string, tmToken: string;
  let sponsor: CreatedSponsor, game: CreatedGame, workspace: CreatedWorkspace;
  let specId: string, playerId: string, teamId: string, challengeId: string;
  let previousSponsorId = 'other';

  test.beforeEach(async () => {
    gbToken = await getAdminToken();
    tmToken = await getTopoMojoAdminToken();
    sponsor = await createSponsor(gbToken, `Res-${Date.now()}`);
    ({ previousSponsorId } = await setAdminSponsor(gbToken, sponsor.id));
    workspace = await createWorkspace(tmToken, { name: `Res-WS-${Date.now()}`, audience: 'gameboard' });
    game = await createGame(gbToken, { name: `Res-${Date.now()}`, startOffsetDays: -1, endOffsetDays: 30 });
    const spec = await addChallengeSpecToGame(gbToken, game.id, { externalId: workspace.id, name: 'WithRes' });
    specId = spec.id;
    const player = await enrollAdmin(gbToken, game.id);
    playerId = player.id; teamId = player.teamId;

    const client = await gbConnect();
    try {
      const stateJson = JSON.stringify({
        id: 'seed', name: 'WithRes',
        challenge: { text: 'Resourced challenge', maxAttempts: 3, maxPoints: 100, attempts: 0, score: 0, sectionCount: 1, sectionIndex: 0, questions: [] },
        vms: [
          { id: 'vm-1', name: 'win10-workstation', isolationId: 'iso-1' },
        ],
        isActive: true,
      });
      const ch = await seedChallenge(client, {
        gameId: game.id, specId, playerId, teamId,
        externalId: workspace.id, name: 'WithRes', points: 100,
        stateJson, hasDeployedGamespace: true,
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

  test('Challenge Resources and Materials', async ({ gameboardAuthenticatedPage: page }) => {
    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      const res = await ctx.fetch(`http://localhost:5002/api/challenge/${challengeId}`, {
        headers: { Authorization: `Bearer ${gbToken}` },
      });
      const detail = await res.json();
      const stringified = JSON.stringify(detail);
      expect(stringified).toContain('win10-workstation');
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
