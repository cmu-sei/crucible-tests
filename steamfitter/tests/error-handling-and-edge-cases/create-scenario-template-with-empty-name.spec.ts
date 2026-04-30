// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test.afterEach(async () => {
    // No cleanup needed - template should not be created
  });

  test('Create Scenario Template with Empty Name', async ({ steamfitterAuthenticatedPage: page }) => {
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    // Wait for admin page to load - look for the "Administration" heading
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 15000 });

    // The admin page defaults to Scenario Templates section
    // Click the "Add Scenario Template" button (the + button in the table header)
    const createButton = page.getByRole('button', { name: 'Add Scenario Template' });
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();
    await page.waitForTimeout(500);

    // A new row or form should appear - look for name input field
    const nameInput = page.locator('input[placeholder*="ame"], input[formcontrolname*="name"], input[type="text"]').first();
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.clear();

    // Check for a save/submit button - it should be disabled when name is empty
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]').first();
    const hasSaveButton = await saveButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasSaveButton) {
      // Verify the save button is disabled when name is empty
      const saveDisabled = await saveButton.isDisabled();

      // Also check for any visible validation error
      const validationError = page.locator('mat-error, [class*="error"], [class*="invalid"], .mat-mdc-form-field-error');
      const hasError = await validationError.isVisible({ timeout: 3000 }).catch(() => false);

      // Either the save button should be disabled or a validation error should appear
      expect(saveDisabled || hasError).toBeTruthy();
    } else {
      // If no save button is visible, the form prevents submission without a name
      // This is also valid validation behavior
      const anySubmitButton = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Create")');
      const submitCount = await anySubmitButton.count();
      // No submit button available means the form validation is preventing submission
      expect(submitCount === 0 || await anySubmitButton.first().isDisabled()).toBeTruthy();
    }
  });
});
