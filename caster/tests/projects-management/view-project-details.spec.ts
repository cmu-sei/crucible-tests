// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  CASTER_THEMES,
  setCasterTheme,
  seedCasterProjectPageFree,
  deleteCasterProjectPageFree,
  Services,
} from '../../fixtures';

let projectId: string;
const projectName = 'E2E Shared Project [view-project-details]';

test.beforeAll(async () => {
  projectId = await seedCasterProjectPageFree(projectName);
});

test.afterAll(async () => {
  await deleteCasterProjectPageFree(projectId);
});

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Projects Management`, () => {
    test('View Project Details', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      // Navigate to the project
      await page.goto(`${Services.Caster.UI}/projects/${projectId}`);

      // expect: Project name is shown in the topbar
      await expect(page.getByText(projectName, { exact: true })).toBeVisible();

      // expect: Sidebar options are available for: Add Directory, Export Project, Import Project
      await expect(page.getByText('Add Directory', { exact: true })).toBeVisible();
      await expect(page.getByText('Export Project', { exact: true })).toBeVisible();
      await expect(page.getByText('Import Project', { exact: true })).toBeVisible();

      // expect: Main content shows placeholder when no file/workspace is selected
      await expect(page.getByText('Please open a file or workspace')).toBeVisible();
    });
  });
}
