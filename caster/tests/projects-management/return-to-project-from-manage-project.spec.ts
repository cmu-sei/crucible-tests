// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  Services,
  CASTER_THEMES,
  setCasterTheme,
  seedCasterSharedProjectPageFree,
  casterSharedProjectName,
  deleteCasterProjectPageFree,
} from '../../fixtures';

let projectId: string;
let projectName: string;

test.beforeAll(async ({}, workerInfo) => {
  projectName = casterSharedProjectName('return-to-project-from-manage-project', workerInfo);
  projectId = await seedCasterSharedProjectPageFree(projectName);
});

test.afterAll(async () => {
  await deleteCasterProjectPageFree(projectId);
});

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Projects Management`, () => {
    test('Return To The Project From Manage Project', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

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

    test('Open Project Memberships In Place In Administration', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      // 1. Find the project in Administration → Projects
      await page.goto(`${Services.Caster.UI}/admin?section=Projects`);
      await page.getByRole('textbox', { name: 'Search' }).fill(projectName);
      const row = page.getByRole('row').filter({ hasText: projectName });
      await expect(row).toHaveCount(1);
      await expect(row).toHaveAttribute('aria-expanded', 'false');

      // 2. Click the row
      await row.getByRole('cell', { name: projectName, exact: true }).click();

      // expect: its memberships open under the row, still inside Administration
      await expect(row).toHaveAttribute('aria-expanded', 'true');
      const memberships = page.getByText('Memberships', { exact: true });
      await expect(memberships).toBeVisible();
      await expect(page).toHaveURL(/\/admin/);

      // expect: the row already names the project, so there's no title and no way back to leave by
      await expect(page.getByRole('heading', { level: 1, name: projectName })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Return to Project' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Return', exact: true })).toHaveCount(0);

      // 3. Click the row again
      await row.getByRole('cell', { name: projectName, exact: true }).click();

      // expect: the memberships close, and the project list is unchanged
      await expect(row).toHaveAttribute('aria-expanded', 'false');
      await expect(memberships).toBeHidden();
      await expect(page.getByRole('button', { name: 'Add New Project' })).toBeVisible();
    });
  });
}
