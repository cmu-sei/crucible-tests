// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, seedCasterSharedProjectPageFree, casterSharedProjectName, seedCasterDirectoryPageFree, deleteCasterProjectPageFree, CASTER_THEMES, setCasterTheme, Services } from '../../fixtures';

test.describe('Designs Management', () => {
  let projectId: string;
  let directoryId: string;
  const dirName = 'Designs-Directory';

  test.beforeAll(async ({}, workerInfo) => {
    const projectName = casterSharedProjectName('view-designs-list', workerInfo);
    projectId = await seedCasterSharedProjectPageFree(projectName);
    directoryId = await seedCasterDirectoryPageFree(projectId, dirName);
  });

  test.afterAll(async () => {
    if (projectId) await deleteCasterProjectPageFree(projectId);
  });

  for (const theme of CASTER_THEMES) {
    test(`${theme} theme › View Designs List`, async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      // Navigate to project
      await page.goto(`${Services.Caster.UI}/projects/${projectId}`);
      await expect(page.getByRole('button', { name: dirName })).toBeVisible({ timeout: 10000 });

      await page.getByRole('button', { name: dirName }).click();
      await expect(page.getByRole('button', { name: 'DESIGNS', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'DESIGNS', exact: true }).click();
    });
  }
});
