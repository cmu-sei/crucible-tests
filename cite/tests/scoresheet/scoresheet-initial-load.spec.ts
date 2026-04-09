// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Scoresheet Interface', () => {
  test('Scoresheet Initial Load', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to evaluation and switch to scoresheet view
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await page.waitForLoadState('domcontentloaded');

    const scoresheetTab = page.locator('[role="tab"]:has-text("Scoresheet"), button:has-text("Scoresheet"), a:has-text("Scoresheet")').first();
    await expect(scoresheetTab).toBeVisible({ timeout: 10000 });
    await scoresheetTab.click();

    // expect: Scoresheet interface loads
    await page.waitForLoadState('domcontentloaded');

    // expect: Scoring categories are displayed
    const categories = page.locator('[class*="category"], [class*="scoring-category"], mat-expansion-panel').first();
    await expect(categories).toBeVisible({ timeout: 10000 });

    // expect: Scoring options are visible for each category
    const options = page.locator('[class*="option"], [class*="scoring-option"], mat-radio-button, mat-checkbox').first();
    await expect(options).toBeVisible({ timeout: 10000 });
  });
});
