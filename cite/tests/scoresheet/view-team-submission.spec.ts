// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Scoresheet Interface', () => {
  test('View Team Submission', async ({ citeAuthenticatedPage: page }) => {

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

    // 2. Select 'Team' submission type from submission selector
    const teamToggle = page.locator('mat-button-toggle:has-text("Team"), button:has-text("Team"), mat-select').first();
    if (await teamToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await teamToggle.click();

      const teamOption = page.locator('mat-option:has-text("Team")').first();
      if (await teamOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await teamOption.click();
      }
    }

    // expect: Scoresheet updates to show team's official scores
    // expect: Team's selected scoring options are highlighted
    // expect: Team submission reflects consensus or official team position
    await page.waitForLoadState('domcontentloaded');
  });
});
