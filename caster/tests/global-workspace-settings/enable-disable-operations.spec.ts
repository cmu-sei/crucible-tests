// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Global Workspace Settings', () => {
  test('Enable Disable Workspace Operations', async ({ casterAuthenticatedPage: page }) => {

    await page.goto(Services.Caster.UI + '/admin?section=Workspaces');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 10000 });

    const disableToggle = page.getByRole('switch', { name: 'Disable Workspace Operations' });
    await expect(disableToggle).toBeVisible();

    // 2. Toggle on
    await disableToggle.click();

    // 4. Toggle back off
    await disableToggle.click();
    await expect(disableToggle).toBeVisible();
  });
});
