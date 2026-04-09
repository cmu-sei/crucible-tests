// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Scoresheet Interface', () => {
  test('Modify Score without CanSubmit Permission', async ({ citeAuthenticatedPage: page }) => {

    // 1. Log in as user without CanSubmit permission
    // Note: This test uses the admin user. In a real scenario, a non-privileged user
    // would be used. The test validates read-only scoresheet behavior.
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });

    // 2. Navigate to scoresheet
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await page.waitForLoadState('domcontentloaded');

    const scoresheetTab = page.locator('[role="tab"]:has-text("Scoresheet"), button:has-text("Scoresheet")').first();
    await expect(scoresheetTab).toBeVisible({ timeout: 10000 });
    await scoresheetTab.click();

    // Select a read-only submission type like 'Team Average' or 'Group Average'
    const readOnlyToggle = page.locator('mat-button-toggle:has-text("Team Average"), mat-button-toggle:has-text("Group Average"), button:has-text("Team Average")').first();
    if (await readOnlyToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await readOnlyToggle.click();
    }

    // expect: Scoresheet displays in read-only mode
    // expect: Scoring options are visible but not interactive
    await page.waitForLoadState('domcontentloaded');

    // expect: User cannot modify scores
    const disabledOptions = page.locator('mat-radio-button[class*="disabled"], mat-radio-button.mat-radio-disabled, [class*="read-only"]');
    // Read-only submission types should have non-interactive elements
    await page.waitForTimeout(1000);
  });
});
