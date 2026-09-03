// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Pools Management', () => {
  test('Create New Pool', async ({ casterAuthenticatedPage: page, cleanupCasterPool }) => {

    // Intercept the pool creation response so we can register it for cleanup
    const createdPoolId = page.waitForResponse(
      (resp) => resp.url().includes('/api/vlans/pools') && resp.request().method() === 'POST' && resp.ok(),
    );

    await page.goto(Services.Caster.UI + '/admin?section=VLANs');
    await expect(page.getByRole('heading', { name: 'Pools' })).toBeVisible({ timeout: 10000 });

    const addButton = page.getByRole('tabpanel', { name: 'Pools' }).getByRole('button').first();
    await addButton.click();

    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible({ timeout: 5000 }).catch(() => false)) {
      const nameInput = page.getByRole('textbox', { name: 'Name' });
      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill('Test Pool');
        await page.getByRole('button', { name: 'Save' }).click();
      }
    }

    // Wait for the POST response and register the new pool for cleanup
    const response = await createdPoolId;
    const body = await response.json();
    if (body?.id) {
      cleanupCasterPool(body.id);
    }
  });
});
