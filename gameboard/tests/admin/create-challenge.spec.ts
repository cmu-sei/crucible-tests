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

// Gameboard does not "create" challenges — they originate in TopoMojo as
// workspaces and are added to a game as challenge specs. This test authors
// a new TopoMojo workspace with challenge content and attaches it to a
// Gameboard game as a new challenge.
test.describe('Admin - Challenges', () => {
  let gbToken: string;
  let tmToken: string;
  let game: CreatedGame;
  let workspace: CreatedWorkspace;
  let spec: CreatedChallengeSpec | null = null;

  test.beforeEach(async () => {
    gbToken = await getAdminToken();
    tmToken = await getTopoMojoAdminToken();
    workspace = await createWorkspace(tmToken, {
      name: `SQLInj-${Date.now()}`,
      description: 'Identify and mitigate a SQL injection vulnerability.',
      audience: 'gameboard',
    });
    game = await createGame(gbToken, { name: `CreateChal-Game-${Date.now()}` });
  });

  test.afterEach(async () => {
    if (spec) await deleteChallengeSpec(gbToken, spec.id).catch(() => {});
    if (game) await deleteGame(gbToken, game.id);
    if (workspace) await deleteWorkspace(tmToken, workspace.id);
  });

  test('Create New Challenge (TopoMojo-backed)', async ({ gameboardAuthenticatedPage: page }) => {
    spec = await addChallengeSpecToGame(gbToken, game.id, {
      externalId: workspace.id,
      name: 'SQL Injection Defense',
      description: 'Find and patch the vulnerability.',
      points: 500,
    });
    expect(spec.id).toBeTruthy();
    expect(spec.externalId).toBe(workspace.id);

    // UI sanity — admin dashboard still reachable.
    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
