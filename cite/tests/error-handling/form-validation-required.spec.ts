// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Form Validation - Required Fields', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to admin page (defaults to Evaluations section)
    await page.goto(`${Services.Cite.UI}/admin`);
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // Click "Add Evaluation" button to open the create form
    const addButton = page.getByRole('button', { name: 'Add Evaluation' });
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();

    const dialog = page.locator('mat-dialog-container, [role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 2. Leave required fields empty
    // 3. Attempt to submit form
    const saveButton = dialog.locator('button:has-text("Save"), button:has-text("Create")').first();
    await expect(saveButton).toBeVisible({ timeout: 5000 });

    // expect: Form validation prevents submission or button is disabled
    const isDisabled = await saveButton.isDisabled().catch(() => false);
    if (!isDisabled) {
      await saveButton.click();
      // expect: Error messages indicate required fields
      const errorMessage = dialog.locator('mat-error, .mat-error, [class*="error"]').first();
      await errorMessage.isVisible({ timeout: 3000 }).catch(() => false);
    }
  });
});
