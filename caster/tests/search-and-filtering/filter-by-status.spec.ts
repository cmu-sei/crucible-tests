// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, CASTER_THEMES, setCasterTheme } from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Search and Filtering`, () => {
    test('Filter by Status', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      await page.goto(Services.Caster.UI + '/admin?section=Workspaces');

      await expect(page.getByRole('columnheader', { name: 'Status', exact: true })).toBeVisible({ timeout: 10000 });

      // Statuses are plain words, so Search filters by them
      const searchBox = page.getByRole('textbox', { name: 'Search' });
      await searchBox.fill('Applied');
      // expect: an active run is never Applied, so nothing matches
      await expect(page.getByRole('cell', { name: 'No active runs match "Applied"' })).toBeVisible();
      await page.getByRole('button', { name: 'Clear Search' }).click();
      await expect(searchBox).toHaveValue('');
    });
  });
}
