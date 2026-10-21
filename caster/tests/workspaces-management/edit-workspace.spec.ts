// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  casterApi,
  openCasterDirectory,
  seedCasterDirectory,
  seedCasterProject,
  seedCasterWorkspace,
  CASTER_THEMES,
  setCasterTheme,
} from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Workspaces Management`, () => {
    test('Edit Workspace', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
      await setCasterTheme(page, theme);
      const projectId = await seedCasterProject(page, `Edit WS Project ${Date.now()}`);
      cleanupCasterProject(projectId);
      const directoryId = await seedCasterDirectory(page, projectId, 'Edit-WS-Dir');
      const workspaceId = await seedCasterWorkspace(page, directoryId, 'WS_To_Edit');

      // 1. List the directory's workspaces
      await openCasterDirectory(page, projectId, 'Edit-WS-Dir');
      await page.getByRole('button', { name: 'WORKSPACES', exact: true }).click();
      const workspaces = page.getByRole('region', { name: 'WORKSPACES' });
      await expect(workspaces.getByRole('button', { name: 'WS_To_Edit', exact: true })).toBeVisible();

      // 2. Edit it from its context menu
      await workspaces.getByRole('button', { name: 'WS_To_Edit', exact: true }).click({ button: 'right' });
      await page.getByRole('menuitem', { name: 'Edit' }).click();

      // expect: the edit dialog, holding the current values
      const dialog = page.getByRole('dialog', { name: 'Edit Workspace' });
      const name = dialog.getByRole('textbox', { name: 'Name' });
      await expect(name).toHaveValue('WS_To_Edit');
      await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();

      // 3. Rename it
      await name.fill('WS_Edited');

      // 4. Save
      const save = page.waitForRequest(
        (r) => ['PUT', 'PATCH'].includes(r.method()) && new URL(r.url()).pathname.endsWith(`/api/workspaces/${workspaceId}`)
      );
      await dialog.getByRole('button', { name: 'Save' }).click();
      const body = (await save).postDataJSON();

      // expect: the request leaves out the directory; the API keeps the stored one
      expect(body).toMatchObject({ name: 'WS_Edited' });
      expect(body).not.toHaveProperty('directoryId');

      // expect: the list shows the new name, and the workspace is still in its directory
      await expect(dialog).toBeHidden();
      await expect(workspaces.getByRole('button', { name: 'WS_Edited', exact: true })).toBeVisible();
      await expect(workspaces.getByRole('button', { name: 'WS_To_Edit', exact: true })).toHaveCount(0);
      expect((await casterApi(page, 'GET', `workspaces/${workspaceId}`)).body).toMatchObject({
        name: 'WS_Edited',
        directoryId,
      });
    });
  });
}
