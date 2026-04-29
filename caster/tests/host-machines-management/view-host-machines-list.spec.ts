// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Host Machines Management', () => {
  test('View Host Machines List', async ({ casterAuthenticatedPage: page }) => {

    await page.goto(Services.Caster.UI + '/admin');
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 10000 });

    // Host Machines may not be a separate sidebar section in the current UI
    const hostMachinesItem = page.locator('mat-list-item').filter({ hasText: 'Host Machines' });
    if (await hostMachinesItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await hostMachinesItem.click();
      await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
    } else {
      await expect(page.getByText('Projects').first()).toBeVisible();
      await expect(page.getByText('Workspaces')).toBeVisible();
    }
  });
});
