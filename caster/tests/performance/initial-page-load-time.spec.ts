// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, setCasterTheme, CASTER_THEMES } from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Performance and Optimization`, () => {
    test('Initial Page Load Time', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    // Verify page is interactive
    await page.getByRole('textbox', { name: 'Search' }).click();
    await expect(page.getByRole('textbox', { name: 'Search' })).toBeFocused();
    });
});
}
