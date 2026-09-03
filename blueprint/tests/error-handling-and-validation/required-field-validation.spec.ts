// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  navigateToMsel,
  retypeMselField,
} from '../../test-helpers';

test.describe('Error Handling and Validation', () => {
  let token: string;
  let mselId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token);
    mselId = msel.id;
  });

  test.afterEach(async () => {
    if (mselId) {
      await deleteMsel(token, mselId);
    }
  });

  test('Required Field Validation', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to the seeded MSEL
    await navigateToMsel(page, mselId);

    // Locate the Name field and Save button
    const nameField = page.getByRole('textbox', { name: 'Name' });
    const descriptionField = page.getByRole('textbox', { name: 'Description' });
    const saveButton = page.getByRole('button', { name: 'Save Changes' });
    await expect(nameField).toBeVisible({ timeout: 10000 });
    await expect(saveButton).toBeVisible({ timeout: 10000 });

    // Initially, save button should be disabled (no changes)
    await expect(saveButton).toBeDisabled();

    // Dirty the form via another field first — clearing Name alone does not set
    // `isChanged`, so Save staying disabled afterward would prove nothing about
    // validation (it would just mean nothing was edited).
    // Typed via retypeMselField, not fill(): the Config tab marks itself dirty from keypress
    // handlers, so a fill()ed edit leaves Save disabled and the test never reaches validation.
    await retypeMselField(descriptionField, 'Dirtying the form so Save becomes available');
    await expect(saveButton).toBeEnabled();

    // Clear the name field to trigger required-field validation
    await retypeMselField(nameField, '');

    // expect: Save button becomes disabled again when the required field is empty
    await expect(saveButton).toBeDisabled();

    // expect: A validation error message should appear indicating the field is required
    const errorMessage = page.locator('mat-error').filter({ hasText: /required|must not be empty/i });
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // Fill in a valid name
    await retypeMselField(nameField, 'Valid MSEL Name');

    // expect: Error message disappears
    await expect(errorMessage).not.toBeVisible();

    // expect: Save button becomes enabled with valid data
    await expect(saveButton).toBeEnabled({ timeout: 5000 });

    // Clear the name again to re-trigger validation
    await retypeMselField(nameField, '');

    // expect: Save button is disabled again
    await expect(saveButton).toBeDisabled();

    // expect: Validation error re-appears
    await expect(errorMessage).toBeVisible();
  });
});
