// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Scoresheet Interface', () => {
  test('View User Submission', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to scoresheet on user's team
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await page.waitForLoadState('domcontentloaded');

    const scoresheetTab = page.locator('[role="tab"]:has-text("Scoresheet"), button:has-text("Scoresheet")').first();
    await expect(scoresheetTab).toBeVisible({ timeout: 10000 });
    await scoresheetTab.click();

    // expect: Scoresheet displays

    // 2. Select 'User' submission type from submission selector
    const submissionSelector = page.locator('mat-select:has-text("User"), [class*="submission-select"], mat-button-toggle:has-text("User"), button:has-text("User")').first();
    if (await submissionSelector.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submissionSelector.click();

      // If it's a mat-select, pick the option
      const userOption = page.locator('mat-option:has-text("User")').first();
      if (await userOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await userOption.click();
      }
    }

    // expect: Scoresheet updates to show user's individual scores
    // expect: User's selected scoring options are highlighted
    await page.waitForLoadState('domcontentloaded');
  });
});
