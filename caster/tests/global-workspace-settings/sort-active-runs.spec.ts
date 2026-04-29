// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Global Workspace Settings', () => {
  test('Sort Active Runs', async ({ casterAuthenticatedPage: page }) => {

    await page.goto(Services.Caster.UI + '/admin?section=Workspaces');
    await expect(page.getByRole('button', { name: 'createdAt' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'createdAt' }).click();
    await page.getByRole('button', { name: 'createdAt' }).click();
    await page.getByRole('button', { name: 'status' }).click();
    await expect(page.getByRole('button', { name: 'status' })).toBeVisible();
  });
});
