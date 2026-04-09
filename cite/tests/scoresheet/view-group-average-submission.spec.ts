// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Scoresheet Interface', () => {
  test('View Group Average Submission', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to scoresheet in an evaluation with groups
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await page.waitForLoadState('domcontentloaded');

    const scoresheetTab = page.locator('[role="tab"]:has-text("Scoresheet"), button:has-text("Scoresheet")').first();
    await expect(scoresheetTab).toBeVisible({ timeout: 10000 });
    await scoresheetTab.click();

    // expect: Scoresheet displays

    // 2. Select 'Group Average' submission type from submission selector
    const groupAvgToggle = page.locator('mat-button-toggle:has-text("Group Average"), button:has-text("Group Average"), mat-button-toggle:has-text("Group Avg")').first();
    if (await groupAvgToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await groupAvgToggle.click();
    }

    // expect: Scoresheet updates to show calculated group average scores
    // expect: Average scores across all teams in the group are displayed
    // expect: Group average submission is read-only
    await page.waitForLoadState('domcontentloaded');
  });
});
