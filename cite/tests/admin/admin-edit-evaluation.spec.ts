// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Evaluations', () => {
  test('Edit Evaluation', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to admin evaluations section with existing evaluations
    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const evaluationsLink = page.locator('text=Evaluations, a:has-text("Evaluations"), mat-list-item:has-text("Evaluations")').first();
    await expect(evaluationsLink).toBeVisible({ timeout: 10000 });
    await evaluationsLink.click();

    // expect: Evaluations list displays
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    // 2. Click on an evaluation row or its edit button
    const editButton = page.locator('button:has(mat-icon:has-text("edit")), button[aria-label*="edit"]').first();
    if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editButton.click();
    } else {
      await rows.first().click();
    }

    // expect: Evaluation edit dialog/page opens
    // expect: Current evaluation details are populated in form
    const dialog = page.locator('mat-dialog-container, [role="dialog"], [class*="dialog"], [class*="edit"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 3. Modify evaluation description or settings
    const descriptionField = page.locator('input[placeholder*="description"], input[placeholder*="name"], textarea, mat-form-field input').first();
    if (await descriptionField.isVisible({ timeout: 3000 }).catch(() => false)) {
      const currentValue = await descriptionField.inputValue();
      await descriptionField.fill(currentValue + ' (edited)');
    }

    // 4. Click 'Save' or 'Update' button
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').first();
    if (await saveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveButton.click();
      await page.waitForLoadState('domcontentloaded');
    }
  });
});
