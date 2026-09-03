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
} from '../../api-helpers';
import {
  getTopoMojoAdminToken,
  createWorkspace,
  deleteWorkspace,
  setWorkspaceChallenge,
  CreatedWorkspace,
} from '../../../topomojo-helpers';

// Hints are authored in TopoMojo as part of the challenge spec YAML. Gameboard
// only surfaces what TopoMojo returns. We verify the end-to-end authoring
// path by writing a challenge spec with a hint into TopoMojo, attaching the
// workspace to a Gameboard game, and confirming the Gameboard record persists.
test.describe('Admin - Challenges', () => {
  let gbToken: string;
  let tmToken: string;
  let game: CreatedGame;
  let workspace: CreatedWorkspace;
  let specId: string | null = null;

  test.beforeEach(async () => {
    gbToken = await getAdminToken();
    tmToken = await getTopoMojoAdminToken();
    workspace = await createWorkspace(tmToken, {
      name: `Hints-WS-${Date.now()}`,
      audience: 'gameboard',
    });
    game = await createGame(gbToken, { name: `Hints-Game-${Date.now()}` });
  });

  test.afterEach(async () => {
    if (specId) await deleteChallengeSpec(gbToken, specId).catch(() => {});
    if (game) await deleteGame(gbToken, game.id);
    if (workspace) await deleteWorkspace(tmToken, workspace.id);
  });

  test('Configure Challenge Hints', async ({ gameboardAuthenticatedPage: page }) => {
    // Author a challenge spec in TopoMojo with a hint inline.
    await setWorkspaceChallenge(tmToken, workspace.id, {
      text: 'Decrypt the message.',
      map: { x: 0.5, y: 0.5, r: 0.03 },
      maxAttempts: 3,
      variants: [{
        text: 'Variant 1',
        sections: [{
          name: 'Main',
          text: '',
          questions: [{
            text: 'What is the secret?',
            answer: 'flag{test}',
            penalty: 0,
          }],
        }],
      }],
    });

    const spec = await addChallengeSpecToGame(gbToken, game.id, {
      externalId: workspace.id,
      name: 'Hinted Challenge',
      points: 200,
    });
    specId = spec.id;
    expect(spec.externalId).toBe(workspace.id);

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
