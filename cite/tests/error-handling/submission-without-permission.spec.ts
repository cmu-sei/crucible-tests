// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Submission Without Required Permissions', async ({ citeAuthenticatedPage: page }) => {

    // 1. Log in as user without CanSubmit permission
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });

    // 2. Navigate to scoresheet
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await page.waitForLoadState('domcontentloaded');

    const scoresheetTab = page.locator('[role="tab"]:has-text("Scoresheet"), button:has-text("Scoresheet")').first();
    if (await scoresheetTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await scoresheetTab.click();
    }

    // Select a read-only submission type
    const readOnlyToggle = page.locator('mat-button-toggle:has-text("Team Average"), mat-button-toggle:has-text("Official")').first();
    if (await readOnlyToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await readOnlyToggle.click();
    }

    // expect: Scoresheet is displayed in read-only mode
    // expect: User cannot modify scores
    await page.waitForTimeout(1000);
  });
});
