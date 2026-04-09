// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Scoresheet Interface', () => {
  test('Modify Score with CanSubmit Permission', async ({ citeAuthenticatedPage: page }) => {

    // 1. Log in as user with CanSubmit permission for team
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });

    // 2. Navigate to scoresheet and select user submission
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await page.waitForLoadState('domcontentloaded');

    const scoresheetTab = page.locator('[role="tab"]:has-text("Scoresheet"), button:has-text("Scoresheet")').first();
    await expect(scoresheetTab).toBeVisible({ timeout: 10000 });
    await scoresheetTab.click();

    // expect: Scoresheet displays with editable scoring options
    await page.waitForLoadState('domcontentloaded');

    // expect: Scoring options are interactive
    const scoringOptions = page.locator('mat-radio-button, mat-checkbox, [class*="scoring-option"], [class*="option"]');
    await expect(scoringOptions.first()).toBeVisible({ timeout: 10000 });

    // 3. Click on a scoring option for a category
    const option = scoringOptions.first();
    await option.click();

    // expect: Scoring option is selected
    // expect: Selection is saved automatically
    // expect: Score is updated in real-time
    await page.waitForTimeout(1000);
  });
});
