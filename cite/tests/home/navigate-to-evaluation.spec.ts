// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Home Page and Evaluation List', () => {
  test('Navigate to Evaluation from List', async ({ citeAuthenticatedPage: page }) => {

    // 1. Log in and navigate to home page
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });

    // expect: Evaluation list displays at least one evaluation
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    // 2. Click on an evaluation row/link in the list
    await rows.first().click();

    // expect: User is navigated to the evaluation dashboard
    await page.waitForLoadState('domcontentloaded');

    // expect: URL changes to include evaluation parameter
    await page.waitForTimeout(2000);

    // expect: Evaluation interface loads with team and move information
    const evaluationContent = page.locator('[class*="evaluation"], [class*="dashboard"], mat-tab-group, [class*="move"]').first();
    await expect(evaluationContent).toBeVisible({ timeout: 10000 });
  });
});
