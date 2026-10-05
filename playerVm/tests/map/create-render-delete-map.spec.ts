// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoPlayerVm, PLAYERVM_THEMES } from '../../fixtures';

for (const theme of PLAYERVM_THEMES) {
  test.describe(`${theme} theme › Map Application`, () => {
    // Happy path for an editor: create a map for the team, confirm it renders on
    // the map page, then delete it (restoring the no-map state). Complements the
    // no-map and invalid-view tests.
    test('Editor can create, view, and delete a map', async ({
      playerVmAuthenticatedPage: page,
      playerVmView: view,
    }, testInfo) => {
      // A freshly seeded view: no map yet, and the admin who created it can edit.
      await gotoPlayerVm(page, `/views/${view.id}/map`, theme);

      const newMapButton = page.getByRole('button', { name: 'New Map' });
      await expect(newMapButton).toBeVisible({ timeout: 30000 });

      // Unique per theme and worker so parallel runs never share a map name.
      const mapName = `E2E Map ${theme} w${testInfo.workerIndex} ${Date.now()}`;

      // 1. Open the New Map dialog and fill it in
      await newMapButton.click();
      const dialog = page.getByRole('dialog', { name: 'New Map' });
      await expect(dialog).toBeVisible();

      await dialog.getByRole('textbox', { name: 'Name' }).fill(mapName);
      await dialog
        .getByRole('textbox', { name: 'External Image URL' })
        .fill(
          'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Blank_map.svg/640px-Blank_map.svg.png'
        );

      // Assign the first available team (the primary team for this view)
      await dialog.getByRole('combobox', { name: 'Teams' }).click();
      await page.getByRole('option').first().click();
      await page.keyboard.press('Escape');

      // 2. Submit and confirm the map renders
      // The dialog moved to the shared crucible-dialog (vm.ui #586), whose
      // submit button is labelled "Save".
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(dialog).toBeHidden({ timeout: 15000 });

      // The newly-created map is selected and its controls appear.
      await expect(page.getByRole('button', { name: 'Delete Map' })).toBeVisible({
        timeout: 15000,
      });
      await expect(
        page.getByRole('heading', { name: 'No Map is assigned to this Team' })
      ).toHaveCount(0);

      // 3. Clean up: delete the map and confirm we return to the no-map state
      await page.getByRole('button', { name: 'Delete Map' }).click();
      const confirmDialog = page.getByRole('dialog', { name: 'Delete Map?' });
      await expect(confirmDialog).toBeVisible();
      await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click();

      await expect(
        page.getByRole('heading', { name: 'No Map is assigned to this Team' })
      ).toBeVisible({ timeout: 15000 });
    });
  });
}
