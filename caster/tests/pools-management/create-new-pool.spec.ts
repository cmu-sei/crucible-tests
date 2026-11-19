// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, CASTER_THEMES, setCasterTheme, gotoCasterVlansAdmin, casterPoolRow } from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Pools Management`, () => {
    test('Create New Pool', async ({ casterAuthenticatedPage: page, cleanupCasterPool }) => {
      await setCasterTheme(page, theme);
      await gotoCasterVlansAdmin(page);

      // Add New Pool creates the pool straight away, with no dialog; the API names it.
      const created = page.waitForResponse(
        (resp) => resp.url().includes('/api/vlans/pools') && resp.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'Add New Pool' }).click();

      const response = await created;
      expect(response.status()).toBe(201);
      const pool = await response.json();
      cleanupCasterPool(pool.id);
      expect(pool).toMatchObject({ name: 'New Pool', isDefault: false });

      await expect(page.getByText('Added New Pool')).toBeVisible();
      // Other workers may have added a "New Pool" of their own, so only require one.
      await expect(casterPoolRow(page, 'New Pool').first()).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });
  });
}
