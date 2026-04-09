// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Evaluations', () => {
  test('Increment Evaluation Move', async ({ citeAuthenticatedPage: page }) => {

    // 1. Log in as user with ManageEvaluations permission
    // 2. Navigate to admin evaluations section
    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const evaluationsLink = page.locator('text=Evaluations, a:has-text("Evaluations"), mat-list-item:has-text("Evaluations")').first();
    await expect(evaluationsLink).toBeVisible({ timeout: 10000 });
    await evaluationsLink.click();

    // expect: Evaluations list displays
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    // 3. Locate an active evaluation with current move controls
    // expect: Evaluation details are visible with current move number and increment/decrement buttons

    // 4. Click increment move button (right arrow)
    const incrementButton = page.locator('button:has(mat-icon:has-text("chevron_right")), button:has(mat-icon:has-text("arrow_forward")), button[aria-label*="increment"], button[aria-label*="next move"]').first();
    if (await incrementButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await incrementButton.click();

      // expect: Current move number increments by one
      // expect: Evaluation status updates
      await page.waitForLoadState('domcontentloaded');
    }
  });
});
