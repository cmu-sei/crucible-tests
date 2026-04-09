// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Evaluation Dashboard Interface', () => {
  test('Section Navigation - Switch to Scoresheet', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to evaluation dashboard
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await page.waitForLoadState('domcontentloaded');

    // expect: Dashboard view is displayed

    // 2. Click on 'Scoresheet' tab or navigation button
    const scoresheetTab = page.locator('[role="tab"]:has-text("Scoresheet"), mat-tab:has-text("Scoresheet"), button:has-text("Scoresheet"), a:has-text("Scoresheet")').first();
    await expect(scoresheetTab).toBeVisible({ timeout: 10000 });
    await scoresheetTab.click();

    // expect: View switches to scoresheet section
    // expect: Scoresheet interface is displayed
    await page.waitForLoadState('domcontentloaded');

    // expect: Scoring categories and options are visible
    const scoresheetContent = page.locator('[class*="scoresheet"], [class*="scoring"], [class*="category"]').first();
    await expect(scoresheetContent).toBeVisible({ timeout: 10000 });
  });
});
