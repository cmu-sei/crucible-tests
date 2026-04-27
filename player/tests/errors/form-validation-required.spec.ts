// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Form Validation - Required Fields', async ({ playerAuthenticatedPage: page }) => {
    // 1. Navigate to a form (e.g., create view dialog)
    await expect(page.getByText('My Views')).toBeVisible();
    const createButton = page.locator('button:has(mat-icon[fonticon="mdi-plus-circle"])');
    await createButton.click();

    // expect: Form is displayed
    const dialog = page.getByRole('dialog', { name: 'Create New View?' });
    await expect(dialog).toBeVisible();

    // 2. Leave required fields empty
    const nameField = dialog.getByRole('textbox', { name: 'Name' });
    await expect(nameField).toHaveValue('');

    // expect: Required fields are marked (asterisk visible via CSS ::after on required marker)
    await expect(dialog.locator('.mat-mdc-form-field-required-marker')).toBeVisible();

    // 3. Attempt to submit form
    const saveButton = dialog.getByRole('button', { name: 'Save' });

    // expect: Form validation prevents submission
    // expect: Error messages indicate required fields
    await expect(saveButton).toBeDisabled();

    // Cancel the dialog
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  });
});
