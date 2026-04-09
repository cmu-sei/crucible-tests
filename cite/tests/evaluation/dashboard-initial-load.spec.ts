// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Evaluation Dashboard Interface', () => {
  test('Dashboard Initial Load', async ({ citeAuthenticatedPage: page }) => {

    // 1. Log in and select an evaluation from the home page
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();

    // expect: Dashboard page loads
    await page.waitForLoadState('domcontentloaded');

    // expect: Evaluation information header is displayed
    const header = page.locator('[class*="evaluation"], [class*="header"], mat-toolbar, [class*="title"]').first();
    await expect(header).toBeVisible({ timeout: 10000 });

    // expect: Team selector is visible
    const teamSelector = page.locator('mat-select, [class*="team-select"], select, [class*="team"]').first();
    await expect(teamSelector).toBeVisible({ timeout: 10000 });

    // expect: Move navigation controls are present
    const moveNav = page.locator('[class*="move"], button[aria-label*="move"], [class*="stepper"]').first();
    await expect(moveNav).toBeVisible({ timeout: 10000 });

    // expect: Main content area displays dashboard view
    const content = page.locator('[class*="dashboard"], [class*="content"], mat-tab-group').first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });
});
