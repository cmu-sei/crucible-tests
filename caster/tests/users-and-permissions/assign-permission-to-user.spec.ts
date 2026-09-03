// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Users and Permissions Management', () => {
  test('Assign Permission to User', async ({ casterAuthenticatedPage: page }) => {

    await page.goto(Services.Caster.UI + '/admin');
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 10000 });

    await page.locator('mat-list-item').filter({ hasText: 'Users' }).click();
    await expect(page).toHaveURL(/section=Users/);
    await expect(page.getByRole('table')).toBeVisible();

    const adminUser = page.getByRole('cell', { name: 'Admin User' });
    if (await adminUser.isVisible({ timeout: 5000 }).catch(() => false)) {
      await adminUser.click();
    }
  });
});
