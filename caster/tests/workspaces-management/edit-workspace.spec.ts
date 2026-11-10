// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  casterApi,
  openCasterDirectory,
  seedCasterProjectPageFree,
  seedCasterDirectoryPageFree,
  seedCasterWorkspacePageFree,
  deleteCasterProjectPageFree,
  deleteCasterWorkspacePageFree,
  CASTER_THEMES,
  setCasterTheme,
} from '../../fixtures';

test.describe('Workspaces Management › Edit Workspace', () => {
  let projectId: string;
  let directoryId: string;
  const directoryName = 'Edit-WS-Dir';
  let workspaceId: string | null = null;

  test.beforeAll(async () => {
    projectId = await seedCasterProjectPageFree('E2E Shared Project [edit-workspace]');
    directoryId = await seedCasterDirectoryPageFree(projectId, directoryName);
  });

  test.beforeEach(() => {
    workspaceId = null;
  });

  test.afterEach(async () => {
    if (workspaceId) {
      await deleteCasterWorkspacePageFree(workspaceId);
    }
  });

  test.afterAll(async () => {
    await deleteCasterProjectPageFree(projectId);
  });

  for (const theme of CASTER_THEMES) {
    test(`Edit Workspace - ${theme}`, async ({ casterAuthenticatedPage: page }, testInfo) => {
      await setCasterTheme(page, theme);

      // Each test gets its own workspace to edit (mutator: edits it)
      const workspaceName = `WS_To_Edit_${theme}_${testInfo.repeatEachIndex}`;
      workspaceId = await seedCasterWorkspacePageFree(directoryId, workspaceName);

      // 1. List the directory's workspaces
      await openCasterDirectory(page, projectId, directoryName);
      await page.getByRole('button', { name: 'WORKSPACES', exact: true }).click();
      const workspaces = page.getByRole('region', { name: 'WORKSPACES' });
      await expect(workspaces.getByRole('button', { name: workspaceName, exact: true })).toBeVisible();

      // 2. Edit it from its context menu
      await workspaces.getByRole('button', { name: workspaceName, exact: true }).click({ button: 'right' });
      await page.getByRole('menuitem', { name: 'Edit' }).click();

      // expect: the edit dialog, holding the current values
      const dialog = page.getByRole('dialog', { name: 'Edit Workspace' });
      const name = dialog.getByRole('textbox', { name: 'Name' });
      await expect(name).toHaveValue(workspaceName);
      await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();

      // 3. Rename it
      const newName = `${workspaceName}_Edited`;
      await name.fill(newName);

      // 4. Save
      const save = page.waitForRequest(
        (r) => ['PUT', 'PATCH'].includes(r.method()) && new URL(r.url()).pathname.endsWith(`/api/workspaces/${workspaceId}`)
      );
      await dialog.getByRole('button', { name: 'Save' }).click();
      const body = (await save).postDataJSON();

      // expect: the request leaves out the directory; the API keeps the stored one
      expect(body).toMatchObject({ name: newName });
      expect(body).not.toHaveProperty('directoryId');

      // expect: the list shows the new name, and the workspace is still in its directory
      await expect(dialog).toBeHidden();
      await expect(workspaces.getByRole('button', { name: newName, exact: true })).toBeVisible();
      await expect(workspaces.getByRole('button', { name: workspaceName, exact: true })).toHaveCount(0);
      expect((await casterApi(page, 'GET', `workspaces/${workspaceId}`)).body).toMatchObject({
        name: newName,
        directoryId,
      });
    });
  }
});
