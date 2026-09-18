// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, setCasterTheme, CASTER_THEMES } from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Modules Management`, () => {
    test('View Modules List', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

    await page.goto(Services.Caster.UI + '/admin?section=Modules');

    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('columnheader', { name: 'Path' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Versions' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Date Loaded' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Items per page:' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'External Module ID' })).toBeVisible();
    });
});
}
