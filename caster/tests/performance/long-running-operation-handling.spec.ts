// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, seedCasterProjectPageFree, deleteCasterProjectPageFree, CASTER_THEMES, setCasterTheme } from '../../fixtures';

test.describe('Performance and Optimization', () => {
  let projectId: string;
  let projectName: string;

  test.beforeAll(async () => {
    projectName = 'E2E Shared Project [long-running-operation-handling]';
    projectId = await seedCasterProjectPageFree(projectName);
  });

  test.afterAll(async () => {
    if (projectId) await deleteCasterProjectPageFree(projectId);
  });

  for (const theme of CASTER_THEMES) {
    test(`${theme} theme › Long Running Operation Handling`, async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      // Navigate to project
      await page.goto(`${Services.Caster.UI}/projects/${projectId}`);
      await expect(page.getByText(projectName, { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Admin User', exact: true })).toBeVisible();

      await page.goto(Services.Caster.UI + '/admin');
      await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 10000 });

      await page.goBack();
      await expect(page).toHaveURL(/\/projects\//, { timeout: 10000 });
    });
  }
});
