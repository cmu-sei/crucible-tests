// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import {
  getAdminToken,
  createGame,
  deleteGame,
  addChallengeSpecToGame,
  deleteChallengeSpec,
  CreatedGame,
  CreatedChallengeSpec,
} from '../../api-helpers';
import {
  getTopoMojoAdminToken,
  createWorkspace,
  deleteWorkspace,
  CreatedWorkspace,
} from '../../../topomojo-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

// Challenge-spec editing in Gameboard = update the per-game fields (points,
// tag, coordinates, disabled, hidden). The underlying TopoMojo challenge
// content itself is authored in TopoMojo. We verify the Gameboard-side PUT.
test.describe('Admin - Challenges', () => {
  let gbToken: string;
  let tmToken: string;
  let game: CreatedGame;
  let workspace: CreatedWorkspace;
  let spec: CreatedChallengeSpec;

  test.beforeEach(async () => {
    gbToken = await getAdminToken();
    tmToken = await getTopoMojoAdminToken();
    workspace = await createWorkspace(tmToken, {
      name: `EditChal-WS-${Date.now()}`,
      audience: 'gameboard',
    });
    game = await createGame(gbToken, { name: `EditChal-Game-${Date.now()}` });
    spec = await addChallengeSpecToGame(gbToken, game.id, {
      externalId: workspace.id,
      name: 'Original Name',
      points: 100,
    });
  });

  test.afterEach(async () => {
    if (spec) await deleteChallengeSpec(gbToken, spec.id).catch(() => {});
    if (game) await deleteGame(gbToken, game.id);
    if (workspace) await deleteWorkspace(tmToken, workspace.id);
  });

  test('Edit Challenge Details - Update Points', async ({ gameboardAuthenticatedPage: page }) => {
    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      // PUT /api/challengespec with updated fields
      const putRes = await ctx.fetch('http://localhost:5002/api/challengespec', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${gbToken}`,
          'Content-Type': 'application/json',
        },
        data: {
          id: spec.id,
          externalId: spec.externalId,
          name: 'Updated Name',
          description: 'new description',
          text: 'new description',
          gameEngineType: 'topoMojo',
          solutionGuideUrl: '',
          showSolutionGuideInCompetitiveMode: false,
          tags: '',
          tag: '',
          disabled: false,
          averageDeploySeconds: 0,
          isHidden: false,
          points: 400,
          x: 0.5,
          y: 0.5,
          r: 0.03,
        },
      });
      expect(putRes.ok(), `PUT status: ${putRes.status()}`).toBe(true);

      const getRes = await ctx.fetch(`http://localhost:5002/api/challengespec/${spec.id}`, {
        headers: { Authorization: `Bearer ${gbToken}` },
      });
      const updated = await getRes.json();
      expect(updated.name).toBe('Updated Name');
      expect(updated.points).toBe(400);
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
