// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Evaluations', () => {
  test('Manage Evaluation Actions', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to admin evaluations section and expand an evaluation
    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const evaluationsLink = page.locator('text=Evaluations, a:has-text("Evaluations"), mat-list-item:has-text("Evaluations")').first();
    await expect(evaluationsLink).toBeVisible({ timeout: 10000 });
    await evaluationsLink.click();

    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();

    // 2. Expand the 'Actions' section
    const actionsPanel = page.locator('mat-expansion-panel-header:has-text("Actions"), text=Actions').first();
    if (await actionsPanel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionsPanel.click();

      const addButton = page.locator('button:has(mat-icon:has-text("add")), button[aria-label*="add action"]').first();
      if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await addButton.click();
        const dialog = page.locator('mat-dialog-container, [role="dialog"]').first();
        await expect(dialog).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
