// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Scoring Models', () => {
  test('Manage Scoring Options', async ({ citeAuthenticatedPage: page }) => {

    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const scoringModelsLink = page.locator('text=Scoring Models, a:has-text("Scoring Models"), mat-list-item:has-text("Scoring Models")').first();
    await expect(scoringModelsLink).toBeVisible({ timeout: 10000 });
    await scoringModelsLink.click();

    const rows = page.locator('mat-row, tbody tr').first();
    await expect(rows).toBeVisible({ timeout: 10000 });
    await rows.click();
    await page.waitForTimeout(1000);

    // Expand Categories to find scoring options
    const categoriesPanel = page.locator('mat-expansion-panel-header:has-text("Categories"), text=Categories').first();
    if (await categoriesPanel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await categoriesPanel.click();
      await page.waitForTimeout(500);

      // Locate a category and click add option button
      const addOptionButton = page.locator('button:has(mat-icon:has-text("add")), button[aria-label*="add option"]').first();
      if (await addOptionButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await addOptionButton.click();
        const dialog = page.locator('mat-dialog-container, [role="dialog"]').first();
        await expect(dialog).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
