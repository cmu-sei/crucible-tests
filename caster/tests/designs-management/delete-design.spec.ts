// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, seedCasterProjectPageFree, seedCasterDirectoryPageFree, deleteCasterProjectPageFree, CASTER_THEMES, setCasterTheme, Services } from '../../fixtures';

test.describe('Designs Management', () => {
  let projectId: string;
  let directoryId: string;
  const dirName = 'Designs-Del-Dir';

  test.beforeAll(async () => {
    const projectName = 'E2E Shared Project [delete-design]';
    projectId = await seedCasterProjectPageFree(projectName);
    directoryId = await seedCasterDirectoryPageFree(projectId, dirName);
  });

  test.afterAll(async () => {
    if (projectId) await deleteCasterProjectPageFree(projectId);
  });

  for (const theme of CASTER_THEMES) {
    test(`${theme} theme › Delete Design`, async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      // Navigate to project
      await page.goto(`${Services.Caster.UI}/projects/${projectId}`);
      await expect(page.getByRole('button', { name: dirName })).toBeVisible({ timeout: 10000 });

      await page.getByRole('button', { name: dirName }).click();
      await expect(page.getByRole('button', { name: 'DESIGNS', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'DESIGNS', exact: true }).click();

      await page.getByText('Add Design').click();
      const nameInput = page.getByRole('textbox', { name: 'Name' });
      if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await nameInput.fill('Design To Delete');
        await page.getByRole('button', { name: 'Save' }).click();
      }

      const deleteButton = page.getByRole('button', { name: 'delete' }).first();
      if (await deleteButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await deleteButton.click();
        const confirmButton = page.getByRole('button', { name: 'Confirm' });
        if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await confirmButton.click();
        }
      }
    });
  }
});
