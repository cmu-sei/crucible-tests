// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, typeIntoSearch, PLAYER_THEMES, setPlayerTheme } from '../../fixtures';
import { deleteView, getPlayerToken, listViews } from '../../../player-helpers';

for (const theme of PLAYER_THEMES) {
  test.describe(`${theme} theme › Administration - Views`, () => {
    let viewName = '';

    // The view is created through the UI (that is the subject), so it is found by
    // its unique name and deleted through the API even when the test fails midway.
    test.afterEach(async () => {
      if (!viewName) return;
      const token = await getPlayerToken();
      for (const view of await listViews(token)) {
        if (view.name === viewName) await deleteView(token, view.id);
      }
      viewName = '';
    });

    test('Create View', async ({ playerAuthenticatedPage: page }) => {
      await setPlayerTheme(page, theme);
      viewName = `Create Test View ${Date.now()}`;

      // 1. Navigate to admin views section
      await page.getByRole('button', { name: 'Menu' }).click();
      await page.getByRole('menuitem', { name: 'Administration' }).click();
      await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

      // expect: Views list is displayed
      await expect(page.getByRole('heading', { name: 'Views' })).toBeVisible();

      // 2. Click 'Create' or 'Add View' button (the + icon button, mdi-plus)
      const createButton = page
        .locator('app-admin-view-search')
        .locator('button:has(mat-icon[fonticon="mdi-plus-circle"])');
      await createButton.click();

      // expect: Create view dialog/form opens
      // The edit view form should appear with empty fields

      // 3. Enter view name
      const nameField = page.getByRole('textbox', { name: 'Name (required)' });
      await expect(nameField).toBeVisible({ timeout: 5000 });
      await nameField.fill(viewName);

      // expect: Name field accepts input
      await expect(nameField).toHaveValue(viewName);

      // 4. Enter view description 'Test Description'
      const descField = page.getByRole('textbox', { name: 'Description (required)' });
      await descField.fill('Test Description');

      // expect: Description field accepts input
      await expect(descField).toHaveValue('Test Description');

      // 5. Click 'Save' or 'Done' button
      await page.getByRole('button', { name: 'Done' }).click();

      // expect: View is created successfully
      // expect: New view appears in views list
      await expect(page.getByRole('heading', { name: 'Views' })).toBeVisible();
      const searchField = page.getByRole('textbox', { name: 'Search' });
      await typeIntoSearch(searchField, viewName);
      await expect(searchField).toHaveValue(viewName);
      await expect(page.getByRole('button', { name: viewName, exact: true })).toBeVisible();
    });
  });
}
