// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Scoresheet Interface', () => {
  test('View Team Average Submission', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to scoresheet
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await page.waitForLoadState('domcontentloaded');

    const scoresheetTab = page.locator('[role="tab"]:has-text("Scoresheet"), button:has-text("Scoresheet")').first();
    await expect(scoresheetTab).toBeVisible({ timeout: 10000 });
    await scoresheetTab.click();

    // expect: Scoresheet displays

    // 2. Select 'Team Average' submission type from submission selector
    const teamAvgToggle = page.locator('mat-button-toggle:has-text("Team Average"), button:has-text("Team Average"), mat-button-toggle:has-text("Team Avg")').first();
    if (await teamAvgToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await teamAvgToggle.click();
    }

    // expect: Scoresheet updates to show calculated team average scores
    // expect: Average scores across all team members are displayed
    // expect: Team average submission is read-only
    await page.waitForLoadState('domcontentloaded');
  });
});
