// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import {
  createWorkspace,
  deleteGamespace,
  deleteWorkspace,
  getTopoMojoAdminToken,
  setWorkspaceChallenge,
} from '../../../topomojo-helpers';

test.describe('Gamespace Management', () => {
  let workspaceId: string | undefined;
  let gamespaceId: string | undefined;

  test.beforeEach(async () => {
    // A published workspace of its own. It has no VM templates, so the deploy is a
    // gamespace registration with nothing to boot — no real VM is started. TopoMojo
    // clones the workspace's challenge into the gamespace and needs one variant to
    // pick, so the challenge gets a minimal one.
    const token = await getTopoMojoAdminToken();
    workspaceId = (await createWorkspace(token, {
      name: `E2E Deploy Gamespace ${Date.now()}`,
      audience: 'everyone',
    })).id;
    await setWorkspaceChallenge(token, workspaceId, {
      text: 'Deploy check.',
      variants: [{
        text: 'Variant 1',
        sections: [{ name: 'Main', text: '', questions: [{ text: 'Ready?', answer: 'yes', penalty: 0 }] }],
      }],
    });
  });

  test.afterEach(async () => {
    const token = await getTopoMojoAdminToken();
    if (gamespaceId) await deleteGamespace(token, gamespaceId);
    if (workspaceId) await deleteWorkspace(token, workspaceId);
    gamespaceId = undefined;
    workspaceId = undefined;
  });

  test('Deploy Gamespace', async ({ topomojoAuthenticatedPage: page }) => {
    // 1. Navigate to the gamespace preview for the published workspace
    // expect: Preview page displays with the Start (deploy) option
    await page.goto(`${Services.TopoMojo.UI}/mojo/${workspaceId}`, { waitUntil: 'domcontentloaded' });
    const startButton = page.getByRole('button', { name: 'Start', exact: true });
    await expect(startButton).toBeVisible();

    // 2. Click 'Start', then confirm. The UI registers (and deploys) the gamespace
    // with POST /api/gamespace.
    await startButton.click();
    const registered = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/api\/gamespace$/.test(new URL(r.url()).pathname),
    );
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    const response = await registered;
    expect(response.ok()).toBe(true);
    const state: { id?: string; isActive?: boolean } = await response.json();
    gamespaceId = state.id;
    expect(state.isActive).toBe(true);

    // expect: The page shows the active gamespace — its End control and countdown
    await expect(page.getByRole('button', { name: 'End', exact: true }).first()).toBeVisible();
    await expect(startButton).toHaveCount(0);
  });
});
