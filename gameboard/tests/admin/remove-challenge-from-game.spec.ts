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
      name: `RemChal-WS-${Date.now()}`,
      audience: 'gameboard',
    });
    game = await createGame(gbToken, { name: `RemChal-Game-${Date.now()}` });
    spec = await addChallengeSpecToGame(gbToken, game.id, {
      externalId: workspace.id,
      name: 'Challenge to Remove',
    });
  });

  test.afterEach(async () => {
    if (game) await deleteGame(gbToken, game.id);
    if (workspace) await deleteWorkspace(tmToken, workspace.id);
  });

  test('Remove Challenge from Game', async ({ gameboardAuthenticatedPage: page }) => {
    const before = await listGameChallengeSpecs(gbToken, game.id);
    expect(before.some(s => s.id === spec.id)).toBe(true);

    await deleteChallengeSpec(gbToken, spec.id);

    const after = await listGameChallengeSpecs(gbToken, game.id);
    expect(after.some(s => s.id === spec.id)).toBe(false);

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
