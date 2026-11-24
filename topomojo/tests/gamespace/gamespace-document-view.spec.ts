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
  setWorkspaceDocument,
} from '../../../topomojo-helpers';

test.describe('Gamespace Operations', () => {
  let workspaceId: string | undefined;
  let gamespaceId: string | undefined;
  const heading = `Mission Briefing ${Date.now()}`;

  test.beforeEach(async () => {
    // A workspace with a document and a minimal challenge, and no VM templates, so starting
    // it registers a gamespace without booting a VM.
    const token = await getTopoMojoAdminToken();
    workspaceId = (await createWorkspace(token, {
      name: `E2E Gamespace Document ${Date.now()}`,
      audience: 'everyone',
    })).id;
    await setWorkspaceDocument(token, workspaceId, [
      `# ${heading}`,
      '',
      '"Find" the flag -- quickly.',
      '',
      '| Host | Address |',
      '| --- | --- |',
      '| web | 10.0.0.5 |',
      '',
    ].join('\n'));
    await setWorkspaceChallenge(token, workspaceId, {
      text: 'Document check.',
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

  test('Gamespace Document View', async ({ topomojoAuthenticatedPage: page }) => {
    // 1. Navigate to the gamespace for the workspace (its preview, before it starts)
    // expect: Gamespace page displays with the workspace document rendered from markdown
    await page.goto(`${Services.TopoMojo.UI}/mojo/${workspaceId}`, { waitUntil: 'domcontentloaded' });
    const doc = page.locator('app-gamespace-state markdown').first();
    await expect(doc.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(doc.locator('table.table-striped')).toContainText('10.0.0.5');
    await expect(doc).toContainText('“Find” the flag – quickly.');

    // 2. Start the gamespace
    // expect: The document stays available while the gamespace runs
    const startButton = page.getByRole('button', { name: 'Start', exact: true });
    await startButton.click();
    const registered = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/api\/gamespace$/.test(new URL(r.url()).pathname),
    );
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    const response = await registered;
    expect(response.ok()).toBe(true);
    gamespaceId = (await response.json()).id;
    await expect(page.getByRole('button', { name: 'End', exact: true }).first()).toBeVisible();
    await expect(doc.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  });
});
