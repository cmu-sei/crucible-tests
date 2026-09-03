// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Global Workspace Settings', () => {
  test('View Global Workspace Settings', async ({ casterAuthenticatedPage: page }) => {

    await page.goto(Services.Caster.UI + '/admin?section=Workspaces');

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('switch', { name: 'Disable Workspace Operations' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Active Runs' })).toBeVisible();
  });
});
