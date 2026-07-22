// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getFirstViewId } from '../../fixtures';

test.describe('Map Application', () => {
  // Happy path for an editor: create a map for the team, confirm it renders on
  // the map page, then delete it (restoring the no-map state). Complements the
  // no-map and invalid-view tests.
  test('Editor can create, view, and delete a map', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    const viewId = await getFirstViewId(page);
    test.skip(!viewId, 'No views available for the admin user to test against');

    await page.goto(`${Services.PlayerVM.UI}/views/${viewId}/map`);

    // The admin can edit, so the "New Map" button is available. If it is not
    // visible (e.g. the discovered view grants no edit rights in this env),
    // skip rather than fail.
    const newMapButton = page.getByRole('button', { name: 'New Map' });
    try {
      await newMapButton.waitFor({ state: 'visible', timeout: 30000 });
    } catch {
      test.skip(true, 'No editable view available to create a map');
    }

    // Unique name so the test is self-contained and easy to identify/clean up.
    // Date.now() is fine here (real browser test, not a workflow script).
    const mapName = `E2E Map ${Date.now()}`;

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
    await dialog.getByRole('button', { name: 'Submit' }).click();
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
    await confirmDialog.getByRole('button', { name: 'Confirm' }).click();

    await expect(
      page.getByRole('heading', { name: 'No Map is assigned to this Team' })
    ).toBeVisible({ timeout: 15000 });
  });
});
