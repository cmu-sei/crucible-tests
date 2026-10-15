// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { deleteViewMaps, seedView } from '../../vm-helpers';

test.describe('Map Application', () => {
  // The view is seeded rather than discovered, which is what makes the editor
  // controls a guarantee instead of a guess: the seeding user creates the view,
  // so they hold the view-creator team role on its Admin team and map-main's
  // canEdit$ (ManageTeam | ManageView) is necessarily true. A discovered view
  // could grant no edit rights, which is why this spec used to skip itself when
  // "New Map" failed to appear — a skip that also hid a genuinely missing button.
  let seeded: Awaited<ReturnType<typeof seedView>>;

  test.beforeAll(async () => {
    seeded = await seedView('E2E Create Map');
  });

  test.afterEach(async () => {
    // The test deletes its map through the UI as the final assertion; this is
    // the safety net for a failure before that point. Maps live in the VM API's
    // own database and are not cascaded by the view delete below.
    if (seeded) {
      await deleteViewMaps(seeded.token, seeded.viewId);
    }
  });

  test.afterAll(async () => {
    await seeded?.cleanup();
  });

  // Happy path for an editor: create a map for the team, confirm it renders on
  // the map page, then delete it (restoring the no-map state). Complements the
  // no-map and invalid-view tests.
  test('Editor can create, view, and delete a map', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    await page.goto(`${Services.PlayerVM.UI}/views/${seeded.viewId}/map`);

    const newMapButton = page.getByRole('button', { name: 'New Map' });
    await expect(newMapButton).toBeVisible({ timeout: 30000 });

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

    // Assign the first available team. The seeded view has exactly one — the
    // Admin team the Player API created with the view.
    await dialog.getByRole('combobox', { name: 'Teams' }).click();
    await page.getByRole('option').first().click();
    await page.keyboard.press('Escape');

    // 2. Submit and confirm the map renders. The primary button reads "Save":
    //    new-map.component wraps crucible-dialog and does not override its
    //    default `submitLabel`.
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden({ timeout: 15000 });

    // The newly-created map is selected and its controls appear.
    await expect(page.getByRole('button', { name: 'Delete Map' })).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByRole('heading', { name: 'No Map is assigned to this Team' })
    ).toHaveCount(0);

    // 3. Delete the map and confirm we return to the no-map state. The seeded
    //    view had no other map, so the no-map message is the expected end state.
    await page.getByRole('button', { name: 'Delete Map' }).click();
    const confirmDialog = page.getByRole('dialog', { name: 'Delete Map?' });
    await expect(confirmDialog).toBeVisible();
    // map-main passes confirmText: 'Delete' to the shared confirm dialog.
    await confirmDialog.getByRole('button', { name: 'Delete' }).click();

    await expect(
      page.getByRole('heading', { name: 'No Map is assigned to this Team' })
    ).toBeVisible({ timeout: 15000 });
  });
});
