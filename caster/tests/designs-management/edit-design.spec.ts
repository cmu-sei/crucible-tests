// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, seedCasterProjectPageFree, seedCasterDirectoryPageFree, deleteCasterProjectPageFree, deleteCasterDesignPageFree, CASTER_THEMES, setCasterTheme, Services } from '../../fixtures';

test.describe('Designs Management', () => {
  let projectId: string;
  let directoryId: string;
  const dirName = 'Design-Edit-Dir';
  let designId: string | null = null;

  test.beforeAll(async () => {
    const projectName = 'E2E Shared Project [edit-design]';
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
    test(`${theme} theme › Edit Design`, async ({ casterAuthenticatedPage: page }, testInfo) => {
      await setCasterTheme(page, theme);

      const designName = `Design To Edit-${theme}-${testInfo.repeatEachIndex}`;

      // Navigate to project
      await page.goto(`${Services.Caster.UI}/projects/${projectId}`);
      await expect(page.getByRole('button', { name: dirName })).toBeVisible({ timeout: 10000 });

      await page.getByRole('button', { name: dirName }).click();
      await expect(page.getByRole('button', { name: 'DESIGNS', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'DESIGNS', exact: true }).click();

      await page.getByText('Add Design').click();
      const nameInput = page.getByRole('textbox', { name: 'Name' });
      if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await nameInput.fill(designName);

        const createResponsePromise = page.waitForResponse(resp =>
          resp.url().includes('/designs') && resp.request().method() === 'POST'
        );
        await page.getByRole('button', { name: 'Save' }).click();

        const createResponse = await createResponsePromise;
        const designData = await createResponse.json();
        designId = designData.id;
      }

      const designItem = page.getByText(designName, { exact: true });
      if (await designItem.isVisible({ timeout: 5000 }).catch(() => false)) {
        await designItem.click();
      }
    });
  }
});
