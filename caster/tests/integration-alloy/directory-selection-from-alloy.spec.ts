// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, setCasterTheme, CASTER_THEMES } from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Integration with Alloy`, () => {
    test('Directory Selection from Alloy', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

    await page.goto(Services.Caster.UI + '/admin');
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 10000 });

    await page.locator('mat-list-item').filter({ hasText: 'Projects' }).click();
    await expect(page).toHaveURL(/section=Projects/);
    });
});
}
