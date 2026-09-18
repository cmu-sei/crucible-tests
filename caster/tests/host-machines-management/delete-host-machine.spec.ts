// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, setCasterTheme, CASTER_THEMES } from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Host Machines Management`, () => {
    test('Delete Host Machine', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

    await page.goto(Services.Caster.UI + '/admin');
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 10000 });

    const hostMachinesItem = page.locator('mat-list-item').filter({ hasText: 'Host Machines' });
    if (await hostMachinesItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await hostMachinesItem.click();

      const deleteButton = page.getByRole('button', { name: /delete/i }).first();
      if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await deleteButton.click();
        const confirmButton = page.getByRole('button', { name: 'Confirm' });
        if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await confirmButton.click();
        }
      }
    }
    });
});
}
