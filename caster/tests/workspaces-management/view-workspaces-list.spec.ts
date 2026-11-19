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
  deleteCasterProjectPageFree,
  CASTER_THEMES,
  setCasterTheme,
} from '../../fixtures';

test.describe('Workspaces Management › View Workspaces List', () => {
  let projectId: string;
  const directoryName = 'WS-List-Dir';

  test.beforeAll(async ({}, workerInfo) => {
    projectId = await seedCasterSharedProjectPageFree(casterSharedProjectName('view-workspaces-list', workerInfo));
    await seedCasterDirectoryPageFree(projectId, directoryName);
  });

  test.afterAll(async () => {
    await deleteCasterProjectPageFree(projectId);
  });

  for (const theme of CASTER_THEMES) {
    test(`View Workspaces List - ${theme}`, async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      // Navigate to the seeded directory
      await openCasterDirectory(page, projectId, directoryName);

      // expect: WORKSPACES section is available
      await expect(page.getByRole('button', { name: 'WORKSPACES' })).toBeVisible();

      // Click to expand WORKSPACES
      await page.getByRole('button', { name: 'WORKSPACES' }).click();

      // expect: Workspaces section shows Add Workspace option
      await expect(page.getByText('Add Workspace')).toBeVisible();
    });
  }
});
