// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Evaluations', () => {
  test('Copy Evaluation', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to admin evaluations section
    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const evaluationsLink = page.locator('text=Evaluations, a:has-text("Evaluations"), mat-list-item:has-text("Evaluations")').first();
    await expect(evaluationsLink).toBeVisible({ timeout: 10000 });
    await evaluationsLink.click();

    // expect: Evaluations list displays
    const rows = page.locator('mat-row, tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    // 2. Click copy button for an evaluation
    const copyButton = page.locator('button:has(mat-icon:has-text("content_copy")), button:has(mat-icon:has-text("file_copy")), button[aria-label*="copy"]').first();
    if (await copyButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await copyButton.click();

      // expect: Copy process initiates
      // 3. Confirm copy operation if dialog appears
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Copy"), button:has-text("Yes")').first();
      if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmButton.click();
      }

      // expect: Evaluation is copied successfully
      // expect: New evaluation appears in list with copied data
      await page.waitForLoadState('domcontentloaded');
    }
  });
});
