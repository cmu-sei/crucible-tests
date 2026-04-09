// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Evaluation Dashboard Interface', () => {
  test('Team Selection', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to evaluation dashboard where user belongs to multiple teams
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await page.waitForLoadState('domcontentloaded');

    // expect: Evaluation dashboard loads with team selector
    const teamSelector = page.locator('mat-select, [class*="team-select"], select').first();
    await expect(teamSelector).toBeVisible({ timeout: 10000 });

    // 2. Click on team selector dropdown
    await teamSelector.click();

    // expect: Team dropdown menu opens
    // expect: List of available teams is displayed
    const options = page.locator('mat-option, option, [role="option"]');
    await expect(options.first()).toBeVisible({ timeout: 5000 });

    // 3. Select a different team from the dropdown
    const optionCount = await options.count();
    if (optionCount > 1) {
      await options.nth(1).click();
    } else {
      await options.first().click();
    }

    // expect: Selected team becomes active
    // expect: Dashboard refreshes to show team-specific data
    await page.waitForLoadState('domcontentloaded');
  });
});
