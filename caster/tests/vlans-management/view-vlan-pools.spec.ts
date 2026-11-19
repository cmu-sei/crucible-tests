// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  CASTER_THEMES,
  setCasterTheme,
  gotoCasterVlansAdmin,
  casterPoolRow,
  casterPoolName,
  seedCasterPool,
} from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › VLANs Management`, () => {
    test('View VLAN Pools', async ({ casterAuthenticatedPage: page, cleanupCasterPool }, testInfo) => {
      await setCasterTheme(page, theme);

      const name = casterPoolName('Search', theme, testInfo.repeatEachIndex);
      cleanupCasterPool(await seedCasterPool(page, name));
      await gotoCasterVlansAdmin(page);

      await expect(page.getByRole('tab', { name: 'Pools', selected: true })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Projects', selected: false })).toBeVisible();

      // Search narrows the table to matching pools.
      const search = page.getByRole('tabpanel', { name: 'Pools' }).getByRole('textbox', { name: 'Search' });
      await search.fill(name);
      await expect(casterPoolRow(page, name)).toBeVisible();
      await expect(casterPoolRow(page, 'New Pool')).toHaveCount(0);

      // No match shows the empty state, and Clear brings the pool back.
      const missing = `${name} no such pool`;
      await search.fill(missing);
      await expect(page.getByText(`No data matching the filter "${missing}"`)).toBeVisible();
      await expect(casterPoolRow(page, name)).toHaveCount(0);

      await page.getByRole('button', { name: 'Clear' }).click();
      await expect(search).toHaveValue('');
      await expect(casterPoolRow(page, name)).toBeVisible();
    });
  });
}
