// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Aggregate Interface', () => {
  test('View Group Aggregations', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to aggregate view in an evaluation with groups
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await page.waitForLoadState('domcontentloaded');

    const aggregateTab = page.locator('[role="tab"]:has-text("Aggregate"), button:has-text("Aggregate")').first();
    await expect(aggregateTab).toBeVisible({ timeout: 10000 });
    await aggregateTab.click();
    await page.waitForLoadState('domcontentloaded');

    // expect: Aggregate view displays
    // expect: Group-level aggregations are shown
    // expect: Combined scores across teams within groups are visible
    // expect: Group names and statistics are displayed
    const groupData = page.locator('[class*="group"], [class*="aggregate"], table, mat-table').first();
    await expect(groupData).toBeVisible({ timeout: 10000 });
  });
});
