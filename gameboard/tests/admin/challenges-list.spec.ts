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

// Exercises the Gameboard admin challenges listing path. We seed a game with
// one TopoMojo-backed challenge so the listing is non-empty.
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
      name: `ListChal-WS-${Date.now()}`,
      audience: 'gameboard',
    });
    game = await createGame(gbToken, { name: `ListChal-Game-${Date.now()}` });
    spec = await addChallengeSpecToGame(gbToken, game.id, {
      externalId: workspace.id,
      name: 'Listed Challenge',
    });
  });

  test.afterEach(async () => {
    if (spec) await deleteChallengeSpec(gbToken, spec.id).catch(() => {});
    if (game) await deleteGame(gbToken, game.id);
    if (workspace) await deleteWorkspace(tmToken, workspace.id);
  });

  test('View Challenge List', async ({ gameboardAuthenticatedPage: page }) => {
    const specs = await listGameChallengeSpecs(gbToken, game.id);
    expect(specs.length).toBeGreaterThanOrEqual(1);
    expect(specs.some(s => s.id === spec.id)).toBe(true);

    await page.goto(Services.Gameboard.UI + '/admin/support', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
    await expect(page.locator('a[href="/admin/support"]').first()).toBeVisible();
  });
});
