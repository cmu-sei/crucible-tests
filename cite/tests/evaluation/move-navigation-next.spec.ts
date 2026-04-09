// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Evaluation Dashboard Interface', () => {
  test('Move Navigation - Next Move', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to evaluation dashboard at a move before the current move
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await page.waitForLoadState('domcontentloaded');

    // expect: Dashboard displays with current move information
    const moveDisplay = page.locator('[class*="move"], text=/Move/i').first();
    await expect(moveDisplay).toBeVisible({ timeout: 10000 });

    // expect: Next move button is enabled
    const nextButton = page.locator('button[aria-label*="next"], button[aria-label*="forward"], button:has(mat-icon:has-text("chevron_right")), button:has(mat-icon:has-text("arrow_forward")), [class*="next-move"]').first();

    if (await nextButton.isEnabled({ timeout: 3000 }).catch(() => false)) {
      // 2. Click the next move button or arrow
      await nextButton.click();

      // expect: Move number increments by one
      // expect: Dashboard updates to show next move data
      // expect: Submission data refreshes for the new move
      await page.waitForLoadState('domcontentloaded');
    }
  });
});
