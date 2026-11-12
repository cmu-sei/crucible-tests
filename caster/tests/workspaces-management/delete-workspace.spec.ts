// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  openCasterDirectory,
  seedCasterSharedProjectPageFree,
  casterSharedProjectName,
  seedCasterDirectoryPageFree,
  seedCasterWorkspacePageFree,
  deleteCasterProjectPageFree,
  CASTER_THEMES,
  setCasterTheme,
} from '../../fixtures';

test.describe('Workspaces Management › Delete Workspace', () => {
  let projectId: string;
  let directoryId: string;
  const directoryName = 'Del-WS-Dir';

  test.beforeAll(async ({}, workerInfo) => {
    projectId = await seedCasterSharedProjectPageFree(casterSharedProjectName('delete-workspace', workerInfo));
    directoryId = await seedCasterDirectoryPageFree(projectId, directoryName);
  });

  test.afterAll(async () => {
    await deleteCasterProjectPageFree(projectId);
  });

  for (const theme of CASTER_THEMES) {
    test(`Delete Workspace - ${theme}`, async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      // Each test gets its own workspace to delete (mutator: deletes it)
      const workspaceName = `WS_To_Delete_${theme}`;
      await seedCasterWorkspacePageFree(directoryId, workspaceName);

      // Navigate to the seeded directory
      await openCasterDirectory(page, projectId, directoryName);
      await page.getByRole('button', { name: 'WORKSPACES' }).click();

      // Get the WORKSPACES region and verify workspace exists
      const workspacesRegion = page.getByRole('region', { name: 'WORKSPACES' });
      const workspaceItem = workspacesRegion.getByRole('button', { name: workspaceName, exact: true });
      await expect(workspaceItem).toBeVisible({ timeout: 5000 });

      // Right-click to open context menu and select Delete
      await workspaceItem.click({ button: 'right' });
      await page.getByRole('menuitem', { name: /delete/i }).click();

      // Confirm deletion
      const deleteDialog = page.getByRole('dialog', { name: 'Delete Workspace' });
      await expect(deleteDialog).toBeVisible();
      await deleteDialog.getByRole('button', { name: 'Delete' }).click();

      // Verify workspace was deleted
      await expect(workspaceItem).toHaveCount(0);
    });
  }
});
