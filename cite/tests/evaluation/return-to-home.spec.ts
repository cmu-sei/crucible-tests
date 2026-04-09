// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Evaluation Dashboard Interface', () => {
  test('Return to Home from Evaluation', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to evaluation dashboard
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await page.waitForLoadState('domcontentloaded');

    // expect: Evaluation dashboard is displayed

    // 2. Click on CITE logo or home link in top bar
    const homeLink = page.locator('a[href="/"], img[src*="cite"], [class*="app-logo"], mat-toolbar a, [class*="home-link"]').first();
    await homeLink.click();

    // expect: User is navigated back to home page
    await page.waitForLoadState('domcontentloaded');

    // expect: Evaluation list is displayed
    const evaluationList = page.locator('mat-table, table, [class*="evaluation"], [class*="list"]').first();
    await expect(evaluationList).toBeVisible({ timeout: 10000 });
  });
});
