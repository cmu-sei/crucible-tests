// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, seedCasterProjectPageFree, seedCasterDirectoryPageFree, deleteCasterProjectPageFree, deleteCasterDesignPageFree, CASTER_THEMES, setCasterTheme, Services } from '../../fixtures';

test.describe('Designs Management', () => {
  let projectId: string;
  let directoryId: string;
  const dirName = 'Designs-Dir';
  let designId: string | null = null;

  test.beforeAll(async () => {
    const projectName = 'E2E Shared Project [create-new-design]';
    projectId = await seedCasterProjectPageFree(projectName);
    directoryId = await seedCasterDirectoryPageFree(projectId, dirName);
  });

  test.beforeEach(() => {
    designId = null;
  });

  test.afterEach(async () => {
    if (designId) {
      await deleteCasterDesignPageFree(designId);
      designId = null;
    }
  });

  test.afterAll(async () => {
    if (projectId) await deleteCasterProjectPageFree(projectId);
  });

  for (const theme of CASTER_THEMES) {
    test(`${theme} theme › Create New Design`, async ({ casterAuthenticatedPage: page }, testInfo) => {
      await setCasterTheme(page, theme);

      const designName = `Test Design-${theme}-${testInfo.repeatEachIndex}`;

      // Navigate to project
      await page.goto(`${Services.Caster.UI}/projects/${projectId}`);
      await expect(page.getByRole('button', { name: dirName })).toBeVisible({ timeout: 10000 });

      // Expand directory and DESIGNS section
      await page.getByRole('button', { name: dirName }).click();
      await expect(page.getByRole('button', { name: 'DESIGNS', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'DESIGNS', exact: true }).click();

      // Click add design button
      await page.getByText('Add Design').click();

      // Fill in design name and capture the response
      const nameInput = page.getByRole('textbox', { name: 'Name' });
      if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await nameInput.fill(designName);
        await expect(nameInput).toHaveValue(designName);

        const createResponsePromise = page.waitForResponse(resp =>
          resp.url().includes('/designs') && resp.request().method() === 'POST'
        );
        await page.getByRole('button', { name: 'Save' }).click();

        const createResponse = await createResponsePromise;
        const designData = await createResponse.json();
        designId = designData.id;
      }
    });
  }
});
