// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, seedCasterSharedProjectPageFree, casterSharedProjectName, deleteCasterProjectPageFree, CASTER_THEMES, setCasterTheme, Services } from '../../fixtures';

test.describe('Search and Filtering', () => {
  let projectId: string;
  let projectName: string;

  test.beforeAll(async ({}, workerInfo) => {
    projectName = casterSharedProjectName('advanced-filtering-multiple-criteria', workerInfo);
    projectId = await seedCasterSharedProjectPageFree(projectName);
  });

  test.afterAll(async () => {
    if (projectId) await deleteCasterProjectPageFree(projectId);
  });

  for (const theme of CASTER_THEMES) {
    test(`${theme} theme › Advanced Filtering with Multiple Criteria`, async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      // Navigate to home to test search
      await page.goto(Services.Caster.UI);
      await expect(page.getByText('My Projects')).toBeVisible();

      const searchBar = page.getByRole('textbox', { name: 'Search' });
      await expect(searchBar).toBeVisible();

      await searchBar.fill(projectName);
      await searchBar.press('End');
      await expect(page.getByRole('link', { name: projectName })).toBeVisible();

      await searchBar.fill('NonexistentCriteria');
      await searchBar.press('End');
      await searchBar.clear();
      await searchBar.press('End');
      await expect(searchBar).toHaveValue('');
      await expect(page.getByText(/No data matching the filter/)).not.toBeVisible();
    });
  }
});
