// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, seedCasterSharedProjectPageFree, casterSharedProjectName, seedCasterDirectoryPageFree, deleteCasterProjectPageFree, setCasterTheme, CASTER_THEMES, Services } from '../../fixtures';

test.describe('Error Handling and Validation', () => {
  let projectId: string;
  let directoryId: string;

  test.beforeAll(async ({}, workerInfo) => {
    const projectName = casterSharedProjectName('terraform-syntax-error-handling', workerInfo);
    projectId = await seedCasterSharedProjectPageFree(projectName);
    directoryId = await seedCasterDirectoryPageFree(projectId, 'TF-Error-Dir');
  });

  test.afterAll(async () => {
    if (projectId) await deleteCasterProjectPageFree(projectId);
  });

  for (const theme of CASTER_THEMES) {
    test(`${theme} theme › Terraform Syntax Error Handling`, async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      // Navigate directly to the project
      await page.goto(`${Services.Caster.UI}/projects/${projectId}`);
      await expect(page.getByRole('button', { name: 'TF-Error-Dir' })).toBeVisible({ timeout: 10000 });

      await page.getByRole('button', { name: 'TF-Error-Dir' }).click();
      await page.getByRole('button', { name: 'FILES' }).click();

      await page.getByText('Add File').click();
      // After clicking "Add File", an inline textbox appears for the filename.
      // Wait for any new textbox to appear and use a longer timeout for Firefox.
      const fileNameInput = page.getByRole('textbox').last();
      await expect(fileNameInput).toBeVisible({ timeout: 10000 });
      await fileNameInput.fill('bad.tf');
    });
  }
});
