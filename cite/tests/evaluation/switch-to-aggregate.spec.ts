// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Evaluation Dashboard Interface', () => {
  test('Section Navigation - Switch to Aggregate', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to evaluation dashboard
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await page.waitForLoadState('domcontentloaded');

    // expect: Dashboard view is displayed

    // 2. Click on 'Aggregate' tab or navigation button
    const aggregateTab = page.locator('[role="tab"]:has-text("Aggregate"), mat-tab:has-text("Aggregate"), button:has-text("Aggregate"), a:has-text("Aggregate")').first();
    await expect(aggregateTab).toBeVisible({ timeout: 10000 });
    await aggregateTab.click();

    // expect: View switches to aggregate section
    // expect: Aggregate scoring view is displayed
    await page.waitForLoadState('domcontentloaded');

    // expect: Combined team/group scores are visible
    const aggregateContent = page.locator('[class*="aggregate"], [class*="combined"], [class*="group"]').first();
    await expect(aggregateContent).toBeVisible({ timeout: 10000 });
  });
});
