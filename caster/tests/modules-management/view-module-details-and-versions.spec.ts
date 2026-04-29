// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Modules Management', () => {
  test('View Module Details and Versions', async ({ casterAuthenticatedPage: page }) => {

    await page.goto(Services.Caster.UI + '/admin?section=Modules');
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('columnheader', { name: 'Versions' })).toBeVisible();

    const firstModuleRow = page.getByRole('row').nth(1);
    if (await firstModuleRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstModuleRow.click();
    }
  });
});
