// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, seedCasterProject, CASTER_THEMES, setCasterTheme } from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Projects Management`, () => {
    test('Return To The Project From Manage Project', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
      await setCasterTheme(page, theme);
      const projectName = `Return Project ${Date.now()}`;
      const projectId = await seedCasterProject(page, projectName);
      cleanupCasterProject(projectId);

      // 1. Open the project, then Manage Project from the user menu
      await page.goto(`${Services.Caster.UI}/projects/${projectId}`);
      await expect(page.getByText(projectName, { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Admin User', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Manage Project' }).click();

      // expect: the project's memberships page, with a named way back
      await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/memberships$`));
      await expect(page.getByRole('heading', { level: 1, name: projectName })).toBeVisible();
      const back = page.getByRole('button', { name: 'Return to Project' });
      await expect(back).toBeVisible();

      // expect: its tooltip says the same as its name
      await back.hover();
      await expect(page.locator('mat-tooltip-component')).toHaveText('Return to Project');

      // 2. Return to the project
      await back.click();

      // expect: the project itself, not the project list
      await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`));
      await expect(page.getByText('Add Directory').filter({ visible: true })).toBeVisible();
    });

    test('Return From Project Memberships In Administration', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
      await setCasterTheme(page, theme);
      const projectName = `Admin Return Project ${Date.now()}`;
      cleanupCasterProject(await seedCasterProject(page, projectName));

      // 1. Find the project in Administration → Projects
      await page.goto(`${Services.Caster.UI}/admin?section=Projects`);
      await page.getByRole('textbox', { name: 'Search' }).fill(projectName);
      const row = page.getByRole('row').filter({ hasText: projectName });
      await expect(row).toHaveCount(1);

      // 2. Open its memberships in place
      await row.locator('mat-cell p', { hasText: projectName }).click();

      // expect: the memberships, still inside Administration, with the shorter "Return"
      await expect(page.getByRole('heading', { level: 1, name: projectName })).toBeVisible();
      await expect(page).toHaveURL(/\/admin/);
      await expect(page.getByRole('button', { name: 'Return to Project' })).toHaveCount(0);
      const back = page.getByRole('button', { name: 'Return', exact: true });
      await expect(back).toBeVisible();

      // 3. Return
      await back.click();

      // expect: back on the project list
      await expect(page.getByRole('heading', { level: 1, name: projectName })).toBeHidden();
      await expect(page.getByRole('button', { name: 'Add New Project' })).toBeVisible();
    });
  });
}
