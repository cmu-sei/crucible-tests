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
    test('VLAN Permissions Enforcement', async ({ casterAuthenticatedPage: page, cleanupCasterPool }, testInfo) => {
      await setCasterTheme(page, theme);

      const name = casterPoolName('Read Only', theme, testInfo.repeatEachIndex);
      cleanupCasterPool(await seedCasterPool(page, name));

      // Take ManageVLANs away from the admin user, keeping ViewVLANs, so the page is read-only.
      await page.route('**/api/permissions/mine', async (route) => {
        const response = await route.fetch();
        const permissions: string[] = await response.json();
        expect(permissions).toContain('ManageVLANs');
        await route.fulfill({ response, json: permissions.filter((p) => p !== 'ManageVLANs') });
      });
      await gotoCasterVlansAdmin(page);

      await expect(page.getByRole('button', { name: 'Add New Pool' })).toBeDisabled();
      const row = casterPoolRow(page, name);
      await expect(row.getByRole('button', { name: `Delete ${name}` })).toBeDisabled();
      await expect(row.getByRole('button', { name: 'Rename', exact: true })).toBeDisabled();

      // Clicking a disabled action leaves the row closed.
      await row.getByRole('button', { name: 'Rename', exact: true }).click({ force: true });
      await expect(row).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByRole('dialog')).toHaveCount(0);

      // The pool still opens for viewing, but its partitions can't be added to.
      await row.getByRole('cell', { name, exact: true }).click();
      const details = page.getByRole('region', { name: `${name} partitions` });
      await expect(details.getByRole('button', { name: 'Add New Partition' })).toBeDisabled();

      await page.getByRole('tab', { name: 'Projects' }).click();
      await expect(page.getByRole('tab', { name: 'Projects', selected: true })).toBeVisible();
    });
  });
}
