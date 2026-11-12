// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, seedCasterSharedProjectPageFree, casterSharedProjectName, deleteCasterProjectPageFree, CASTER_THEMES, setCasterTheme, Services } from '../../fixtures';

test.describe('Users and Permissions Management', () => {
  let projectId: string;
  let projectName: string;

  test.beforeAll(async ({}, workerInfo) => {
    projectName = casterSharedProjectName('project-level-user-permissions', workerInfo);
    projectId = await seedCasterSharedProjectPageFree(projectName);
  });

  test.afterAll(async () => {
    if (projectId) await deleteCasterProjectPageFree(projectId);
  });

  for (const theme of CASTER_THEMES) {
    test(`${theme} theme › Project-Level User Permissions`, async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      // Navigate to project
      await page.goto(`${Services.Caster.UI}/projects/${projectId}`);
      await expect(page.getByText(projectName, { exact: true })).toBeVisible({ timeout: 10000 });
    });
  }
});
