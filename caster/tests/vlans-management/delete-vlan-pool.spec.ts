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
    test('Delete VLAN Pool', async ({ casterAuthenticatedPage: page, cleanupCasterPool }, testInfo) => {
      await setCasterTheme(page, theme);

      const name = casterPoolName('Cancel Delete', theme, testInfo.repeatEachIndex);
      // Registered in case the delete below fails; a 404 at teardown is harmless.
      cleanupCasterPool(await seedCasterPool(page, name));
      await gotoCasterVlansAdmin(page);

      const row = casterPoolRow(page, name);
      const deleteButton = row.getByRole('button', { name: `Delete ${name}` });
      const dialog = page.getByRole('dialog', { name: 'Delete Pool' });

      // Answering No keeps the pool.
      await deleteButton.click();
      await dialog.getByRole('button', { name: 'No' }).click();
      await expect(dialog).toHaveCount(0);
      await expect(row).toBeVisible();
      await expect(row).toHaveAttribute('aria-expanded', 'false');

      // Confirming deletes it.
      await deleteButton.click();
      await dialog.getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByText(`Deleted ${name}`)).toBeVisible();
      await expect(row).toHaveCount(0);
    });
  });
}
