// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, setCasterTheme, CASTER_THEMES } from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Global Workspace Settings`, () => {
    test('Search Active Runs', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

    await page.goto(Services.Caster.UI + '/admin?section=Workspaces');
    await expect(page.getByRole('heading', { name: 'Active Runs' })).toBeVisible({ timeout: 10000 });

    const searchBox = page.getByRole('textbox', { name: 'Search' });
    await expect(searchBox).toBeVisible();
    await searchBox.fill('test-search');
    await searchBox.clear();
    await expect(page.getByRole('status')).toBeVisible();
    });
});
}
