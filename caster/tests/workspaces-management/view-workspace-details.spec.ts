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

test.describe('Workspaces Management › View Workspace Details', () => {
  let projectId: string;
  let directoryId: string;
  const directoryName = 'WS-Detail-Dir';
  const workspaceName = 'Detail_Workspace';

  test.beforeAll(async ({}, workerInfo) => {
    projectId = await seedCasterSharedProjectPageFree(casterSharedProjectName('view-workspace-details', workerInfo));
    directoryId = await seedCasterDirectoryPageFree(projectId, directoryName);
    await seedCasterWorkspacePageFree(directoryId, workspaceName);
  });

  test.afterAll(async () => {
    await deleteCasterProjectPageFree(projectId);
  });

  for (const theme of CASTER_THEMES) {
    test(`View Workspace Details - ${theme}`, async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      // Navigate to the seeded directory
      await openCasterDirectory(page, projectId, directoryName);
      await page.getByRole('button', { name: 'WORKSPACES' }).click();

      // Click the workspace to view its details
      const wsItem = page.getByText(workspaceName, { exact: true });
      await expect(wsItem).toBeVisible({ timeout: 5000 });
      await wsItem.click();
    });
  }
});
