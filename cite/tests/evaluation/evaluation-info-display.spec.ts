// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Evaluation Dashboard Interface', () => {
  test('Evaluation Information Display', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to evaluation dashboard
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await page.waitForLoadState('domcontentloaded');

    // expect: Evaluation description is visible
    const description = page.locator('[class*="description"], [class*="evaluation-name"], [class*="title"]').first();
    await expect(description).toBeVisible({ timeout: 10000 });

    // expect: Current move number is displayed
    const moveNumber = page.locator('[class*="move"], text=/Move\\s*\\d+/i, [class*="stepper"]').first();
    await expect(moveNumber).toBeVisible({ timeout: 10000 });

    // expect: Section navigation tabs are available (Dashboard, Scoresheet, Report, Aggregate)
    const tabs = page.locator('mat-tab-group, [role="tablist"]').first();
    await expect(tabs).toBeVisible({ timeout: 10000 });
  });
});
