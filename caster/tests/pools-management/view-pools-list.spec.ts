// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Pools Management', () => {
  test('View Pools List', async ({ casterAuthenticatedPage: page }) => {

    await page.goto(Services.Caster.UI + '/admin?section=VLANs');

    await expect(page.getByRole('heading', { name: 'Pools' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: 'Pools', selected: true })).toBeVisible();

    const addPoolButton = page.getByRole('tabpanel', { name: 'Pools' }).getByRole('button').first();
    await expect(addPoolButton).toBeVisible();
  });
});
