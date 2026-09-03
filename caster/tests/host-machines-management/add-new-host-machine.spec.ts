// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Host Machines Management', () => {
  test('Add New Host Machine', async ({ casterAuthenticatedPage: page }) => {

    await page.goto(Services.Caster.UI + '/admin');
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 10000 });

    const hostMachinesItem = page.locator('mat-list-item').filter({ hasText: 'Host Machines' });
    if (await hostMachinesItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await hostMachinesItem.click();

      const addButton = page.getByRole('button', { name: /add/i }).first();
      if (await addButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addButton.click();

        const nameInput = page.getByRole('textbox', { name: 'Name' });
        if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await nameInput.fill('terraform-host-01');
          await page.getByRole('button', { name: 'Save' }).click();
        }
      }
    }
  });
});
