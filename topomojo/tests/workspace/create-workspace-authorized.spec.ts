// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, serviceUrlPattern } from '../../fixtures';
import { deleteWorkspace, getTopoMojoAdminToken, listWorkspaces } from '../../../topomojo-helpers';

test.describe('Workspace Management', () => {
  let createdWorkspaceId: string | undefined;

  test.afterEach(async () => {
    // Only the workspace this test created (id from the create response, so it is
    // known even if a later step fails). Never by name: a concurrent run of this test
    // (another browser project) or a person's real workspace may share it.
    if (createdWorkspaceId) await deleteWorkspace(await getTopoMojoAdminToken(), createdWorkspaceId);
    createdWorkspaceId = undefined;
  });

  test('Create Workspace - Authorized Creator', async ({ topomojoAuthenticatedPage: page }) => {
    // The plan's "Test Lab", made unique so concurrent runs never share a workspace name.
    const WORKSPACE_NAME = `Test Lab ${Date.now()}`;

    // 1. Log in as user with creator role - handled by fixture (admin has creator role)
    // expect: User is on home page with the New Workspace button
    await expect(page).toHaveURL(serviceUrlPattern(Services.TopoMojo.UI));
    const createButton = page.getByRole('button', { name: 'add new workspace' });
    await expect(createButton).toBeVisible();

    // 2. Click 'New Workspace'. TopoMojo creates the workspace immediately (no dialog,
    // named "Workspace Title") and routes to its settings editor at /topo/<id>/settings.
    const created = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/api\/workspace$/.test(new URL(r.url()).pathname),
    );
    await createButton.click();
    const createdResponse = await created;
    expect(createdResponse.ok()).toBe(true);
    createdWorkspaceId = (await createdResponse.json()).id;
    await expect(page).toHaveURL(new RegExp(`/topo/${createdWorkspaceId}/settings`));
    const titleField = page.locator('#name-input');
    await expect(titleField).toHaveValue('Workspace Title');

    // 3. Rename it 'Test Lab'. The settings form saves on blur (PUT /api/workspace).
    await titleField.fill(WORKSPACE_NAME);
    const saved = page.waitForResponse(
      (r) => r.request().method() === 'PUT' && /\/api\/workspace$/.test(new URL(r.url()).pathname),
    );
    await titleField.press('Tab');
    expect((await saved).ok()).toBe(true);

    // expect: Workspace is created successfully under its new name
    const token = await getTopoMojoAdminToken();
    const matches = (await listWorkspaces(token, { term: WORKSPACE_NAME })).filter((ws) => ws.id === createdWorkspaceId);
    expect(matches.map((ws) => ws.name)).toEqual([WORKSPACE_NAME]);
  });
});
