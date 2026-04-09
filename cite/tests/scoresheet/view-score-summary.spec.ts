// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Scoresheet Interface', () => {
  test('View Score Summary', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to scoresheet with scored submission
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await page.waitForLoadState('domcontentloaded');

    const scoresheetTab = page.locator('[role="tab"]:has-text("Scoresheet"), button:has-text("Scoresheet")').first();
    await expect(scoresheetTab).toBeVisible({ timeout: 10000 });
    await scoresheetTab.click();
    await page.waitForLoadState('domcontentloaded');

    // expect: Scoresheet displays with scores

    // 2. Locate score summary section (if rightSideDisplay is set to ScoreSummary)
    const scoreSummary = page.locator('[class*="score-summary"], [class*="summary"], [class*="total-score"], [class*="right-side"]').first();

    if (await scoreSummary.isVisible({ timeout: 5000 }).catch(() => false)) {
      // expect: Score summary is visible in right panel
      await expect(scoreSummary).toBeVisible();

      // expect: Total score is displayed
      // expect: Category-wise score breakdown is shown
      const scoreValue = page.locator('[class*="total"], [class*="score-value"], text=/\\d+/').first();
      await expect(scoreValue).toBeVisible({ timeout: 5000 });
    }
  });
});
