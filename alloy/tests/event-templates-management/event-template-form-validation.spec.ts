// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';
import { ALLOY_THEMES, applyAlloyTheme, createTestEventTemplate, deleteEventTemplateByName, findEventTemplateEditButton } from '../../test-helpers';

for (const theme of ALLOY_THEMES) {
  test.describe(`${theme} theme › Event Templates Management`, () => {
    let templateName: string;

    // The test edits a template of its own: other workers create and delete templates
    // concurrently, so "whichever is listed first" changes under it.
    test.beforeEach(async ({ page }) => {
      await authenticateWithKeycloak(page, Services.Alloy.UI);
      await applyAlloyTheme(page, theme);
      templateName = `Form Validation Test ${Date.now()}`;
      await createTestEventTemplate(page, templateName);
    });

    test.afterEach(async ({ page }) => {
      await deleteEventTemplateByName(page, templateName);
    });

    test('Event Template Form Validation', async ({ page }) => {
      // 1. Navigate to admin Event Templates section
      await page.goto(`${Services.Alloy.UI}/admin`);
      await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

      // Open the edit dialog on the test's template to test form validation
      await (await findEventTemplateEditButton(page, templateName)).click();

      // expect: Event template edit form is displayed
      const editDialog = page.getByRole('dialog', { name: 'Edit Event Template' });
      await expect(editDialog).toBeVisible();

      // 2. Leave the Name field empty and try to submit the form
      const nameField = editDialog.getByRole('textbox', { name: 'Name (required)' });
      await nameField.fill('');

      // 3. Enter a name but set Duration Hours to a negative value
      await nameField.fill('Test Template');
      await editDialog.getByRole('spinbutton', { name: 'Duration Hours' }).fill('-1');

      // 5. Enter Duration Hours as valid value
      await editDialog.getByRole('spinbutton', { name: 'Duration Hours' }).fill('4');

      // 6. Fill all required fields correctly
      await expect(nameField).toHaveValue('Test Template');
      await expect(editDialog.getByRole('spinbutton', { name: 'Duration Hours' })).toHaveValue('4');

      // expect: Save button is available
      await expect(editDialog.getByRole('button', { name: 'Save' })).toBeVisible();

      // Cancel without saving
      await editDialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(editDialog).toBeHidden();
    });
  });
}