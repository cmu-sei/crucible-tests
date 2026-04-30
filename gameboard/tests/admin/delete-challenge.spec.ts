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
} from '../../api-helpers';
import {
  getTopoMojoAdminToken,
  createWorkspace,
  deleteWorkspace,
  CreatedWorkspace,
} from '../../../topomojo-helpers';

// Deleting a challenge in Gameboard means removing the challenge-spec record
// from the game. The TopoMojo workspace itself is unaffected.
test.describe('Admin - Challenges', () => {
  let gbToken: string;
  let tmToken: string;
  let game: CreatedGame;
  let workspace: CreatedWorkspace;

  test.beforeEach(async () => {
    gbToken = await getAdminToken();
    tmToken = await getTopoMojoAdminToken();
    workspace = await createWorkspace(tmToken, {
      name: `DelChal-WS-${Date.now()}`,
      audience: 'gameboard',
    });
    game = await createGame(gbToken, { name: `DelChal-Game-${Date.now()}` });
  });

  test.afterEach(async () => {
    if (game) await deleteGame(gbToken, game.id);
    if (workspace) await deleteWorkspace(tmToken, workspace.id);
  });

  test('Delete Challenge (Spec) from Game', async ({ gameboardAuthenticatedPage: page }) => {
    const spec = await addChallengeSpecToGame(gbToken, game.id, {
      externalId: workspace.id,
      name: 'Delete Me',
    });
    expect((await listGameChallengeSpecs(gbToken, game.id)).some(s => s.id === spec.id)).toBe(true);

    await deleteChallengeSpec(gbToken, spec.id);
    expect((await listGameChallengeSpecs(gbToken, game.id)).some(s => s.id === spec.id)).toBe(false);

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
