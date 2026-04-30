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
  listGameChallengeSpecs,
  CreatedGame,
  CreatedChallengeSpec,
} from '../../api-helpers';
import {
  getTopoMojoAdminToken,
  createWorkspace,
  deleteWorkspace,
  CreatedWorkspace,
} from '../../../topomojo-helpers';

// Creates a TopoMojo workspace visible to Gameboard (audience includes
// `gameboard`), then attaches it as a challenge spec to a Gameboard game.
// Verifies the challenge is persisted and associated with the game.
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
      name: `AddChal-WS-${Date.now()}`,
      audience: 'gameboard',
    });
    game = await createGame(gbToken, {
      name: `AddChal-Game-${Date.now()}`,
      startOffsetDays: -1,
      endOffsetDays: 30,
    });
  });

  test.afterEach(async () => {
    if (spec) await deleteChallengeSpec(gbToken, spec.id).catch(() => {});
    if (game) await deleteGame(gbToken, game.id);
    if (workspace) await deleteWorkspace(tmToken, workspace.id);
  });

  test('Add Challenge to Game', async ({ gameboardAuthenticatedPage: page }) => {
    spec = await addChallengeSpecToGame(gbToken, game.id, {
      externalId: workspace.id,
      name: 'Imported Challenge',
      description: 'A TopoMojo workspace attached as a Gameboard challenge.',
      points: 250,
    });
    expect(spec.externalId).toBe(workspace.id);

    const specs = await listGameChallengeSpecs(gbToken, game.id);
    expect(specs.some(s => s.id === spec!.id)).toBe(true);

    // UI sanity — admin area still reachable.
    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
