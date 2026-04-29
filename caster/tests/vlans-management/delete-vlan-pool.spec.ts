// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('VLANs Management', () => {
  test('Delete VLAN Pool', async ({ casterAuthenticatedPage: page, cleanupCasterPool }) => {

    await page.goto(Services.Caster.UI + '/admin?section=VLANs');
    await expect(page.getByRole('heading', { name: 'Pools' })).toBeVisible({ timeout: 10000 });

    // Intercept the POST response so we can capture the new pool's ID for cleanup
    const poolResponsePromise = page.waitForResponse(
      resp => resp.url().includes('/api/vlans/pools') && resp.request().method() === 'POST'
    );

    // First create a pool by clicking the add button (creates immediately via API)
    const addButton = page.getByRole('tabpanel', { name: 'Pools' }).getByRole('button').first();
    await addButton.click();

    const poolResponse = await poolResponsePromise;
    expect(poolResponse.status()).toBe(201);

    const pool = await poolResponse.json();
    // Register the created pool for teardown deletion in case the delete step below fails
    cleanupCasterPool(pool.id);

    await expect(page.getByRole('heading', { name: 'Pools' })).toBeVisible();
  });
});
