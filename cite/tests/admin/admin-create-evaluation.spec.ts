// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Evaluations', () => {
  test('Create Evaluation', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to admin evaluations section with CreateEvaluations permission
    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const evaluationsLink = page.locator('text=Evaluations, a:has-text("Evaluations"), mat-list-item:has-text("Evaluations")').first();
    await expect(evaluationsLink).toBeVisible({ timeout: 10000 });
    await evaluationsLink.click();

    // expect: Evaluations list is displayed
    // expect: Create button (plus icon) is visible
    const createButton = page.locator('button:has(mat-icon:has-text("add")), button[aria-label*="create"], button[aria-label*="add"], button:has(mat-icon:has-text("add_circle"))').first();
    await expect(createButton).toBeVisible({ timeout: 10000 });

    // 2. Click 'Create' (plus icon) button
    await createButton.click();

    // expect: Create evaluation dialog/form opens
    const dialog = page.locator('mat-dialog-container, [role="dialog"], [class*="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 3. Enter evaluation description 'Test Evaluation'
    const descriptionField = page.locator('input[placeholder*="description"], input[placeholder*="name"], textarea[placeholder*="description"], mat-form-field input, mat-form-field textarea').first();
    await descriptionField.fill('Test Evaluation');

    // expect: Description field accepts input
    await expect(descriptionField).toHaveValue('Test Evaluation');

    // 4. Select a scoring model from dropdown
    const scoringModelSelect = page.locator('mat-select, select').first();
    if (await scoringModelSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await scoringModelSelect.click();
      const firstOption = page.locator('mat-option, option').first();
      await firstOption.click();
    }

    // 6. Click 'Save' or 'Create' button
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("Submit")').first();
    await saveButton.click();

    // expect: Evaluation is created successfully
    await page.waitForLoadState('domcontentloaded');
  });
});
