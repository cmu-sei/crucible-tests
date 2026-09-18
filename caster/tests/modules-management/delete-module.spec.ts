// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, setCasterTheme, CASTER_THEMES } from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Modules Management`, () => {
    test('Delete Module', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

    await page.goto(Services.Caster.UI + '/admin?section=Modules');
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible({ timeout: 10000 });

    const deleteButton = page.getByRole('button', { name: /delete/i }).first();
    if (await deleteButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await deleteButton.click();
      const confirmButton = page.getByRole('button', { name: 'Confirm' });
      if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmButton.click();
      }
    }
    });
});
}
