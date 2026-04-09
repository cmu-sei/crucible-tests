// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Scoring Models', () => {
  test('Edit Scoring Model', async ({ citeAuthenticatedPage: page }) => {

    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const scoringModelsLink = page.locator('text=Scoring Models, a:has-text("Scoring Models"), mat-list-item:has-text("Scoring Models")').first();
    await expect(scoringModelsLink).toBeVisible({ timeout: 10000 });
    await scoringModelsLink.click();

    const rows = page.locator('mat-row, tbody tr').first();
    await expect(rows).toBeVisible({ timeout: 10000 });

    // 2. Click on a scoring model or edit button
    const editButton = page.locator('button:has(mat-icon:has-text("edit")), button[aria-label*="edit"]').first();
    if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editButton.click();
    } else {
      await rows.click();
    }

    const dialog = page.locator('mat-dialog-container, [role="dialog"]').first();
    if (await dialog.isVisible({ timeout: 5000 }).catch(() => false)) {
      // 3. Modify scoring model details
      const nameField = page.locator('input, textarea, mat-form-field input').first();
      if (await nameField.isVisible({ timeout: 3000 }).catch(() => false)) {
        const currentValue = await nameField.inputValue();
        await nameField.fill(currentValue + ' (edited)');
      }

      // 4. Save changes
      const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').first();
      await saveButton.click();
      await page.waitForLoadState('domcontentloaded');
    }
  });
});
