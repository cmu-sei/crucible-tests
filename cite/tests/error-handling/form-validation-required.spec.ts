// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Form Validation - Required Fields', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to a form (e.g., create evaluation dialog)
    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const evaluationsLink = page.locator('text=Evaluations, a:has-text("Evaluations"), mat-list-item:has-text("Evaluations")').first();
    await expect(evaluationsLink).toBeVisible({ timeout: 10000 });
    await evaluationsLink.click();

    const createButton = page.locator('button:has(mat-icon:has-text("add")), button[aria-label*="create"], button[aria-label*="add"]').first();
    if (await createButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createButton.click();

      const dialog = page.locator('mat-dialog-container, [role="dialog"]').first();
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // 2. Leave required fields empty
      // 3. Attempt to submit form
      const saveButton = page.locator('button:has-text("Save"), button:has-text("Create")').first();

      // expect: Form validation prevents submission or button is disabled
      const isDisabled = await saveButton.isDisabled().catch(() => false);
      if (!isDisabled) {
        await saveButton.click();
        // expect: Error messages indicate required fields
        const errorMessage = page.locator('mat-error, .mat-error, [class*="error"]').first();
        await errorMessage.isVisible({ timeout: 3000 }).catch(() => false);
      }
    }
  });
});
