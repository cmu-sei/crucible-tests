// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Report Interface', () => {
  test('View Team Comparison', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to report view in an evaluation with multiple teams
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await page.waitForLoadState('domcontentloaded');

    const reportTab = page.locator('[role="tab"]:has-text("Report"), button:has-text("Report")').first();
    await expect(reportTab).toBeVisible({ timeout: 10000 });
    await reportTab.click();
    await page.waitForLoadState('domcontentloaded');

    // expect: Report displays

    // 2. Locate team comparison section
    // expect: Comparison of scores across teams is shown
    const comparison = page.locator('[class*="comparison"], [class*="team"], table, mat-table, [class*="chart"]').first();
    await expect(comparison).toBeVisible({ timeout: 10000 });
  });
});
