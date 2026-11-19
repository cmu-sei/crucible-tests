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
    test('Edit VLAN Pool', async ({ casterAuthenticatedPage: page, cleanupCasterPool }, testInfo) => {
      await setCasterTheme(page, theme);

      const name = casterPoolName('Rename', theme, testInfo.repeatEachIndex);
      const renamed = `${name} Renamed`;
      cleanupCasterPool(await seedCasterPool(page, name));
      await gotoCasterVlansAdmin(page);

      const row = casterPoolRow(page, name);
      await row.getByRole('button', { name: 'Rename', exact: true }).click();

      // Rename opens the shared name dialog, filled in with the current name.
      const dialog = page.getByRole('dialog', { name: `Rename ${name}` });
      const nameInput = dialog.getByRole('textbox', { name: 'Name' });
      await expect(nameInput).toHaveValue(name);
      await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();

      await nameInput.fill(renamed);
      await dialog.getByRole('button', { name: 'Save' }).click();

      await expect(page.getByText(`Renamed ${name} to ${renamed}`)).toBeVisible();
      await expect(casterPoolRow(page, renamed)).toBeVisible();
      await expect(row).toHaveCount(0);
      await expect(dialog).toHaveCount(0);
      // The actions buttons sit in the row, so renaming must not have opened the pool.
      await expect(casterPoolRow(page, renamed)).toHaveAttribute('aria-expanded', 'false');
    });
  });
}
