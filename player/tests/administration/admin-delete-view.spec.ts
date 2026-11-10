// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, typeIntoSearch, PLAYER_THEMES, setPlayerTheme } from '../../fixtures';
import { createView, deleteView, getPlayerToken } from '../../../player-helpers';

for (const theme of PLAYER_THEMES) {
  test.describe(`${theme} theme › Administration - Views`, () => {
    let viewId = '';

    // Deleting the view is the subject, but a failure before the confirm leaves it
    // behind; deleteView tolerates the 404 when the test already removed it.
    test.afterEach(async () => {
      if (viewId) await deleteView(await getPlayerToken(), viewId);
      viewId = '';
    });

    test('Delete View', async ({ playerAuthenticatedPage: page }) => {
      await setPlayerTheme(page, theme);
      const viewName = `Delete Test View ${Date.now()}`;

      // Setup: Create a temporary view for deletion. Seeded through the API before
      // opening Administration, so the admin list loads with it.
      viewId = (await createView(await getPlayerToken(), viewName, 'View to be deleted')).id;

      await page.getByRole('button', { name: 'Menu' }).click();
      await page.getByRole('menuitem', { name: 'Administration' }).click();
      await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });
      await expect(page.getByRole('heading', { name: 'Views' })).toBeVisible();

      const searchField = page.getByRole('textbox', { name: 'Search' });
      await typeIntoSearch(searchField, viewName);
      await expect(searchField).toHaveValue(viewName);
      await expect(page.getByRole('button', { name: viewName, exact: true })).toBeVisible();

      // 1. Navigate to admin views section
      // expect: Views list displays
      await expect(page.getByRole('heading', { name: 'Views' })).toBeVisible();

      // 2. Click on the test view to open its edit form, then click Delete
      await page.getByRole('button', { name: viewName, exact: true }).click();
      await expect(page.getByRole('heading', { name: /Edit View:/ })).toBeVisible();

      await page.getByRole('button', { name: 'Delete View' }).click();

      // expect: Confirmation dialog appears
      // expect: Dialog warns about view deletion
      const confirmDialog = page.getByRole('dialog');
      await expect(confirmDialog).toBeVisible();

      // 3. Click 'NO' in confirmation dialog to cancel
      await confirmDialog.getByRole('button', { name: 'Cancel' }).click();

      // expect: Dialog closes
      // expect: View is not deleted
      await expect(page.getByRole('button', { name: 'Delete View' })).toBeVisible();

      // 4. Click delete button again
      await page.getByRole('button', { name: 'Delete View' }).click();

      // expect: Confirmation dialog appears
      await expect(confirmDialog).toBeVisible();

      // 5. Click 'YES' in dialog to confirm deletion
      await confirmDialog.getByRole('button', { name: 'Delete' }).click();

      // expect: View is deleted successfully
      // expect: View is removed from list
      await expect(page.getByRole('heading', { name: 'Views' })).toBeVisible();
      await expect(page.getByRole('button', { name: viewName, exact: true })).not.toBeVisible();
    });
  });
}
