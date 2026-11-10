// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, seedCasterProjectPageFree, deleteCasterProjectPageFree, CASTER_THEMES, setCasterTheme, Services } from '../../fixtures';

test.describe('Search and Filtering', () => {
  let alphaProjectId: string;
  let betaProjectId: string;
  let alphaProjectName: string;
  let betaProjectName: string;

  test.beforeAll(async () => {
    alphaProjectName = 'E2E Shared Project [filter-by-project-alpha]';
    betaProjectName = 'E2E Shared Project [filter-by-project-beta]';
    alphaProjectId = await seedCasterProjectPageFree(alphaProjectName);
    betaProjectId = await seedCasterProjectPageFree(betaProjectName);
  });

  test.afterAll(async () => {
    if (alphaProjectId) await deleteCasterProjectPageFree(alphaProjectId);
    if (betaProjectId) await deleteCasterProjectPageFree(betaProjectId);
  });

  for (const theme of CASTER_THEMES) {
    test(`${theme} theme › Filter by Project`, async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      // Navigate to home to test filtering
      await page.goto(Services.Caster.UI);
      await expect(page.getByText('My Projects')).toBeVisible();

      const searchBar = page.getByRole('textbox', { name: 'Search' });
      await expect(searchBar).toBeVisible();

      await searchBar.fill('Alpha');
      await searchBar.press('End');
      await expect(page.getByRole('link', { name: alphaProjectName })).toBeVisible();

      await searchBar.clear();
      await searchBar.press('End');
      await expect(searchBar).toHaveValue('');
      await expect(page.getByText(/No data matching the filter/)).not.toBeVisible();
    });
  }
});
