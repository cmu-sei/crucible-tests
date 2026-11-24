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
  test.describe(`${theme} theme › Pools Management`, () => {
    test('View Pool Details', async ({ casterAuthenticatedPage: page, cleanupCasterPool }, testInfo) => {
      await setCasterTheme(page, theme);

      const name = casterPoolName('Details', theme, testInfo.repeatEachIndex);
      cleanupCasterPool(await seedCasterPool(page, name));
      await gotoCasterVlansAdmin(page);

      const row = casterPoolRow(page, name);
      const details = page.getByRole('region', { name: `${name} partitions` });
      await expect(row).toHaveAttribute('aria-expanded', 'false');

      // Clicking the row opens its partitions in place, under the row.
      await row.getByRole('cell', { name, exact: true }).click();
      await expect(row).toHaveAttribute('aria-expanded', 'true');
      await expect(details.getByRole('button', { name: 'Add New Partition' })).toBeEnabled();
      // A new pool has no partitions, so all of its VLANs are unassigned.
      await expect(details.getByText(/\d+ VLANs aren't in any partition/)).toBeVisible();
      await expect(details.getByRole('button', { name: 'Show' })).toBeVisible();

      // Opening the pool counts its partitions and VLANs in the row.
      await expect(row.getByRole('cell').nth(3)).toHaveText('0');
      await expect(row.getByRole('cell').nth(4)).toHaveText(/^\s*0 \/ \d+\s*$/);

      // Clicking the row again closes it.
      await row.getByRole('cell', { name, exact: true }).click();
      await expect(row).toHaveAttribute('aria-expanded', 'false');
      await expect(details.getByRole('button', { name: 'Add New Partition' })).toHaveCount(0);
    });
  });
}
