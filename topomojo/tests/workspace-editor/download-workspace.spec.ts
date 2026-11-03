// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { readFile } from 'fs/promises';
import { test, expect, Services, authenticateTopoMojoWithKeycloak } from '../../fixtures';
import {
  getTopoMojoAdminToken,
  getTopoMojoUser,
  deleteTopoMojoUser,
  createWorkspace,
  deleteWorkspace,
  generateWorkspaceInvite,
  enlistInWorkspace,
  removeWorkspaceWorker,
  requestWorkspaceDownload,
  CreatedWorkspace,
} from '../../../topomojo-helpers';
import {
  getKeycloakAdminToken,
  createKeycloakUser,
  deleteKeycloakUser,
  tempUsername,
  KeycloakUser,
} from '../../../keycloak-admin';

// Each test signs in as a temporary non-admin user, not the shared admin session.
test.use({ storageState: { cookies: [], origins: [] } });

const PASSWORD = 'pw';

/** A zip starts with the local file header signature, and its entry names are stored uncompressed. */
function expectExportZip(body: Buffer): void {
  expect(body.subarray(0, 2).toString('latin1')).toBe('PK');
  expect(body.includes(Buffer.from('_data.json'))).toBe(true);
}

test.describe('Workspace Editor - Download Workspace', () => {
  let tmAdmin: string;
  let kcAdmin: string;
  let workspace: CreatedWorkspace | undefined;
  let adminOnlyWorkspace: CreatedWorkspace | undefined;
  let manager: { user: KeycloakUser; token: string } | undefined;
  let editor: { user: KeycloakUser; token: string } | undefined;

  test.beforeEach(async () => {
    tmAdmin = await getTopoMojoAdminToken();
    kcAdmin = await getKeycloakAdminToken();

    const mu = await createKeycloakUser(kcAdmin, { username: tempUsername('tmmgr'), password: PASSWORD });
    manager = { user: mu, token: await getTopoMojoAdminToken(mu.username, PASSWORD) };
    const eu = await createKeycloakUser(kcAdmin, { username: tempUsername('tmedit'), password: PASSWORD });
    editor = { user: eu, token: await getTopoMojoAdminToken(eu.username, PASSWORD) };

    workspace = await createWorkspace(tmAdmin, { name: `Download-${Date.now()}`, audience: '' });
    adminOnlyWorkspace = await createWorkspace(tmAdmin, { name: `DownloadOther-${Date.now()}`, audience: '' });

    // The admin who created the workspace is its only worker. Removing them makes the
    // next worker to accept the invitation its manager; everyone after that is an editor.
    const code = await generateWorkspaceInvite(tmAdmin, workspace.id);
    const adminUser = await getTopoMojoUser(tmAdmin);
    await removeWorkspaceWorker(tmAdmin, workspace.id, adminUser.id);
    await enlistInWorkspace(manager.token, code);
    await enlistInWorkspace(editor.token, code);
  });

  test.afterEach(async () => {
    if (workspace) await deleteWorkspace(tmAdmin, workspace.id);
    if (adminOnlyWorkspace) await deleteWorkspace(tmAdmin, adminOnlyWorkspace.id);
    for (const u of [manager, editor]) {
      if (!u) continue;
      // Signing in to the UI creates a TopoMojo user record.
      await deleteTopoMojoUser(tmAdmin, u.user.id).catch(() => {});
      await deleteKeycloakUser(kcAdmin, u.user.id);
    }
    workspace = adminOnlyWorkspace = manager = editor = undefined;
  });

  test('Manager downloads their workspace from the Settings tab', async ({ page }) => {
    // An open, unpinned sidebar overlays the Settings form and swallows the click on Download.
    // Pinned, it pushes the content aside instead.
    await page.addInitScript(() => localStorage.setItem('topomojo.sidebar.pinned', 'true'));
    await authenticateTopoMojoWithKeycloak(page, manager!.user.username, PASSWORD);
    await page.goto(`${Services.TopoMojo.UI.replace(/\/$/, '')}/topo/${workspace!.id}/settings`);
    await expect(page.locator('#name-input')).toHaveValue(workspace!.name);

    const downloadButton = page.getByRole('button', { name: 'Download', exact: true });
    await expect(downloadButton).toBeVisible();

    const [response, download] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/workspace/download') && r.request().method() === 'POST'),
      page.waitForEvent('download'),
      downloadButton.click(),
    ]);

    expect(response.status()).toBe(200);
    expect(download.suggestedFilename()).toMatch(/\.zip$/);
    expectExportZip(await readFile(await download.path()));
  });

  test('Editor who is not a manager sees no Download button', async ({ page }) => {
    await authenticateTopoMojoWithKeycloak(page, editor!.user.username, PASSWORD);
    await page.goto(`${Services.TopoMojo.UI.replace(/\/$/, '')}/topo/${workspace!.id}/settings`);

    // The editor can open Settings, so the missing button is the permission at work.
    await expect(page.locator('#name-input')).toHaveValue(workspace!.name);
    await expect(page.getByRole('button', { name: 'Download', exact: true })).toHaveCount(0);
  });

  test('API allows a manager and refuses everyone and everything else', async () => {
    const own = await requestWorkspaceDownload(manager!.token, [workspace!.id]);
    expect(own.status).toBe(200);
    expectExportZip(own.body);

    // Every id is checked: one unmanaged id refuses the whole request.
    const mixed = await requestWorkspaceDownload(manager!.token, [workspace!.id, adminOnlyWorkspace!.id]);
    expect(mixed.status).toBe(403);

    const notManaged = await requestWorkspaceDownload(manager!.token, [adminOnlyWorkspace!.id]);
    expect(notManaged.status).toBe(403);

    const asEditor = await requestWorkspaceDownload(editor!.token, [workspace!.id]);
    expect(asEditor.status).toBe(403);

    // The admin keyword for every workspace is not a manager's to use.
    const all = await requestWorkspaceDownload(manager!.token, ['all']);
    expect(all.status).toBe(403);

    // The admin download endpoint stays admin-only.
    const adminEndpoint = await requestWorkspaceDownload(manager!.token, [workspace!.id], '/api/admin/download');
    expect(adminEndpoint.status).toBe(403);
  });
});
