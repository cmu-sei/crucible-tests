// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Aggregate Interface', () => {
  test('Aggregate Display', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to evaluation and switch to aggregate view
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await page.waitForLoadState('domcontentloaded');

    const aggregateTab = page.locator('[role="tab"]:has-text("Aggregate"), button:has-text("Aggregate"), a:has-text("Aggregate")').first();
    await expect(aggregateTab).toBeVisible({ timeout: 10000 });
    await aggregateTab.click();

    // expect: Aggregate interface loads
    await page.waitForLoadState('domcontentloaded');

    // expect: Combined scoring data is displayed
    // expect: Team or group aggregations are visible
    // expect: Summary statistics are shown
    const aggregateContent = page.locator('[class*="aggregate"], [class*="combined"], [class*="summary"], [class*="group"]').first();
    await expect(aggregateContent).toBeVisible({ timeout: 10000 });
  });
});
