// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Report Interface', () => {
  test('Report Display', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to evaluation and switch to report view
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await page.waitForLoadState('domcontentloaded');

    const reportTab = page.locator('[role="tab"]:has-text("Report"), button:has-text("Report"), a:has-text("Report")').first();
    await expect(reportTab).toBeVisible({ timeout: 10000 });
    await reportTab.click();

    // expect: Report interface loads
    await page.waitForLoadState('domcontentloaded');

    // expect: Summary information is displayed
    // expect: Detailed scoring data is visible
    const reportContent = page.locator('[class*="report"], [class*="summary"], [class*="scoring"]').first();
    await expect(reportContent).toBeVisible({ timeout: 10000 });
  });
});
