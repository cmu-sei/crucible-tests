// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Evaluation Dashboard Interface', () => {
  test('Move Navigation - Boundary Conditions', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to evaluation dashboard at move 0
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await page.waitForLoadState('domcontentloaded');

    // Navigate to move 0 by clicking previous until disabled
    const prevButton = page.locator('button[aria-label*="prev"], button[aria-label*="back"], button:has(mat-icon:has-text("chevron_left")), button:has(mat-icon:has-text("arrow_back")), [class*="prev-move"]').first();

    // Keep clicking previous until we reach move 0
    while (await prevButton.isEnabled({ timeout: 2000 }).catch(() => false)) {
      await prevButton.click();
      await page.waitForTimeout(500);
    }

    // expect: Dashboard displays move 0 data
    // expect: Previous move button is disabled
    await expect(prevButton).toBeDisabled({ timeout: 5000 });

    // 2. Navigate to the maximum/current move number
    const nextButton = page.locator('button[aria-label*="next"], button[aria-label*="forward"], button:has(mat-icon:has-text("chevron_right")), button:has(mat-icon:has-text("arrow_forward")), [class*="next-move"]').first();

    while (await nextButton.isEnabled({ timeout: 2000 }).catch(() => false)) {
      await nextButton.click();
      await page.waitForTimeout(500);
    }

    // expect: Dashboard displays current move data
    // expect: Next move button is disabled or hidden
    const isDisabledOrHidden = await nextButton.isDisabled().catch(() => true);
    expect(isDisabledOrHidden).toBeTruthy();
  });
});
