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
    test('View Pools List', async ({ casterAuthenticatedPage: page, cleanupCasterPool }, testInfo) => {
      await setCasterTheme(page, theme);

      const name = casterPoolName('List', theme, testInfo.repeatEachIndex);
      cleanupCasterPool(await seedCasterPool(page, name));

      await gotoCasterVlansAdmin(page);
      await expect(page.getByRole('tab', { name: 'Pools', selected: true })).toBeVisible();

      const panel = page.getByRole('tabpanel', { name: 'Pools' });
      await expect(panel.getByRole('textbox', { name: 'Search' })).toBeVisible();
      await expect(panel.getByRole('button', { name: 'Add New Pool' })).toBeEnabled();
      await expect(panel.getByRole('button', { name: 'About pools' })).toBeVisible();
      for (const column of ['Pool Name', 'Default', 'Partitions', 'VLANs In Use']) {
        await expect(panel.getByRole('columnheader', { name: column, exact: true })).toBeVisible();
      }

      // A pool that has not been opened yet shows no counts, and is not the default pool.
      const row = casterPoolRow(page, name);
      await expect(row).toBeVisible();
      await expect(row.getByRole('cell')).toHaveText(['', name, '', '-', '-']);
      await expect(row.getByRole('button', { name: `Delete ${name}` })).toBeEnabled();
      await expect(row.getByRole('button', { name: 'Rename', exact: true })).toBeEnabled();
    });
  });
}
