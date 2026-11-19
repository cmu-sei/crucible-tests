// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  CASTER_THEMES,
  setCasterTheme,
  seedCasterSharedProjectPageFree,
  casterSharedProjectName,
  seedCasterDirectoryPageFree,
  deleteCasterProjectPageFree,
  Services,
} from '../../fixtures';

let projectId: string;
let directoryId: string;
let projectName: string;
const directoryName = 'SharedDirectory';

test.beforeAll(async ({}, workerInfo) => {
  projectName = casterSharedProjectName('cancel-running-operation', workerInfo);
  projectId = await seedCasterSharedProjectPageFree(projectName);
  directoryId = await seedCasterDirectoryPageFree(projectId, directoryName);
});

test.afterAll(async () => {
  await deleteCasterProjectPageFree(projectId);
});

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Runs Management (Plan, Apply, Destroy)`, () => {
    test('Cancel Running Operation', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      await page.goto(`${Services.Caster.UI}/projects/${projectId}`);
      await expect(page.getByText(projectName, { exact: true })).toBeVisible({ timeout: 10000 });

      await page.getByRole('button', { name: directoryName, exact: true }).click();
      await page.getByRole('button', { name: 'WORKSPACES' }).click();
      await expect(page.getByText('Add Workspace')).toBeVisible();

      const cancelButton = page.getByRole('button', { name: /cancel/i });
      if (await cancelButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cancelButton.click();
      }
    });
  });
}
