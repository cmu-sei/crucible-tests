// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Performance and Optimization', () => {
  test('Large List Performance', async ({ casterAuthenticatedPage: page }) => {

    await page.goto(Services.Caster.UI + '/admin?section=Users');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole('combobox', { name: 'Items per page:' })).toBeVisible();
    await expect(page.getByRole('status')).toBeVisible();

    const searchBox = page.getByRole('textbox', { name: 'Search' });
    await searchBox.fill('Admin');
    await expect(page.getByRole('cell', { name: 'Admin User' })).toBeVisible();

    await searchBox.clear();
    await expect(page.getByRole('table')).toBeVisible();
  });
});
