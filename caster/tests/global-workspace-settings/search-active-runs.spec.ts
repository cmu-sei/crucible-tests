// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, CASTER_THEMES, setCasterTheme } from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Global Workspace Settings`, () => {
    test('Search Active Runs', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      await page.goto(Services.Caster.UI + '/admin?section=Workspaces');

      const searchBox = page.getByRole('textbox', { name: 'Search' });
      await expect(searchBox).toBeVisible({ timeout: 10000 });

      // 2. Search for something no run matches
      // expect: the table says nothing matches
      await searchBox.fill('test-search');
      const noMatch = page.getByRole('cell', { name: 'No active runs match "test-search"' });
      await expect(noMatch).toBeVisible();

      // 3. Clear the search
      // expect: the filter is removed
      await page.getByRole('button', { name: 'Clear Search' }).click();
      await expect(searchBox).toHaveValue('');
      await expect(noMatch).toBeHidden();
    });
  });
}
