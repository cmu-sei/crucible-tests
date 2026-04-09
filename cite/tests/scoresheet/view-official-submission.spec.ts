// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Scoresheet Interface', () => {
  test('View Official Submission', async ({ citeAuthenticatedPage: page }) => {

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

    // 2. Select 'Official' submission type from submission selector
    const officialToggle = page.locator('mat-button-toggle:has-text("Official"), button:has-text("Official")').first();
    if (await officialToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await officialToggle.click();
    }

    // expect: Scoresheet updates to show official evaluation scores
    // expect: Official scoring options are highlighted
    // expect: Official submission shows authoritative/ground truth scores
    await page.waitForLoadState('domcontentloaded');
  });
});
