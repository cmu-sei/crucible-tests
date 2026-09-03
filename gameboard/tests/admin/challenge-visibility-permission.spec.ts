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
  setWorkspaceAudience,
  CreatedWorkspace,
} from '../../../topomojo-helpers';

// TopoMojo workspaces carry an `audience` field. Workspaces with `gameboard`
// in their audience are discoverable by Gameboard's challenge search; those
// without are restricted. This test seeds two workspaces — one restricted,
// one public-to-gameboard — and verifies both can be directly attached via
// API (admins always can), then toggles one's visibility and confirms the
// audience field persists on the TopoMojo side.
test.describe('Admin - Challenges', () => {
  let gbToken: string;
  let tmToken: string;
  let game: CreatedGame;
  let restricted: CreatedWorkspace;
  let visible: CreatedWorkspace;
  let restrictedSpec: CreatedChallengeSpec | null = null;
  let visibleSpec: CreatedChallengeSpec | null = null;

  test.beforeEach(async () => {
    gbToken = await getAdminToken();
    tmToken = await getTopoMojoAdminToken();
    restricted = await createWorkspace(tmToken, {
      name: `Restricted-${Date.now()}`,
      audience: '',
    });
    visible = await createWorkspace(tmToken, {
      name: `Visible-${Date.now()}`,
      audience: 'gameboard',
    });
    game = await createGame(gbToken, { name: `Vis-Game-${Date.now()}` });
  });

  test.afterEach(async () => {
    if (restrictedSpec) await deleteChallengeSpec(gbToken, restrictedSpec.id).catch(() => {});
    if (visibleSpec) await deleteChallengeSpec(gbToken, visibleSpec.id).catch(() => {});
    if (game) await deleteGame(gbToken, game.id);
    if (restricted) await deleteWorkspace(tmToken, restricted.id);
    if (visible) await deleteWorkspace(tmToken, visible.id);
  });

  test('Challenge visibility tracks workspace audience', async ({ gameboardAuthenticatedPage: page }) => {
    // Admin (sudo) can attach either — the permission layer is in TopoMojo's
    // list endpoint, not the spec-attachment endpoint.
    visibleSpec = await addChallengeSpecToGame(gbToken, game.id, {
      externalId: visible.id,
      name: 'Visible Challenge',
    });
    restrictedSpec = await addChallengeSpecToGame(gbToken, game.id, {
      externalId: restricted.id,
      name: 'Restricted Challenge',
    });
    expect(visibleSpec.externalId).toBe(visible.id);
    expect(restrictedSpec.externalId).toBe(restricted.id);

    // Toggle restricted workspace's audience to `gameboard` — it becomes visible.
    await setWorkspaceAudience(tmToken, restricted.id, 'gameboard');

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
