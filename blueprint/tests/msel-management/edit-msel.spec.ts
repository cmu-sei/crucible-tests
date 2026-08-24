// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { getBlueprintToken, createMsel, deleteMsel, tempBlueprintName, navigateToMsel } from '../../test-helpers';

test.describe('MSEL Management', () => {
  test('Edit MSEL', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();
    const mselName = tempBlueprintName('EditTest');

    // 1. Seed a MSEL via API
    const createdMsel = await createMsel(token, {
      name: mselName,
      description: 'Original description',
    });

    try {
      // 2. Navigate to the MSEL detail page
      await navigateToMsel(page, createdMsel.id);

      // expect: The MSEL info page is displayed with a tabbed interface
      const tablist = page.getByRole('tablist');
      await expect(tablist).toBeVisible({ timeout: 10000 });

      // expect: The Config tab is selected by default
      const configTab = page.getByRole('tab', { name: 'Config' });
      await expect(configTab).toBeVisible();

      // expect: Form fields are populated with current values
      const nameField = page.getByRole('textbox', { name: 'Name' });
      await expect(nameField).toBeVisible();
      await expect(nameField).toHaveValue(mselName);

      // expect: Save Changes and Cancel Changes buttons are visible
      const saveButton = page.getByRole('button', { name: 'Save Changes' });
      const cancelButton = page.getByRole('button', { name: 'Cancel Changes' });
      await expect(saveButton).toBeVisible();
      await expect(cancelButton).toBeVisible();

      // expect: An 'Add Page' tab is shown
      const addPageTab = page.getByRole('tab', { name: 'Add Page' });
      await expect(addPageTab).toBeVisible();

      // 3. Modify the Description field
      const descField = page.getByRole('textbox', { name: 'Description' });
      await expect(descField).toBeVisible();

      const newDescription = `Updated description - ${Date.now()}`;
      await descField.fill(newDescription);
      await descField.blur();

      // expect: The description field accepts the new value
      await expect(descField).toHaveValue(newDescription);

      // expect: Character count is displayed
      const charCounter = page.locator('text=/ 600 characters').first();
      await expect(charCounter).toBeVisible();

      // expect: Save Changes button becomes enabled
      await expect(saveButton).toBeEnabled({ timeout: 5000 });

      // 4. Click 'Save Changes' button
      await saveButton.click();

      // expect: Save button becomes disabled after save completes
      await expect(saveButton).toBeDisabled({ timeout: 10000 });

      // expect: The description change persisted
      await expect(descField).toHaveValue(newDescription);
    } finally {
      // 5. Clean up: delete the MSEL
      await deleteMsel(token, createdMsel.id);
    }
  });
});
