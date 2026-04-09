// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Evaluations', () => {
  test('Evaluations Section Navigation', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to admin page
    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // expect: Admin page loads with sidebar

    // 2. Click on 'Evaluations' section in sidebar
    const evaluationsLink = page.locator('text=Evaluations, a:has-text("Evaluations"), mat-list-item:has-text("Evaluations"), button:has-text("Evaluations")').first();
    await expect(evaluationsLink).toBeVisible({ timeout: 10000 });
    await evaluationsLink.click();

    // expect: Evaluations management section displays
    await page.waitForLoadState('domcontentloaded');

    // expect: List of all evaluations is shown
    const evaluationsList = page.locator('mat-table, table, [class*="evaluation-list"]').first();
    await expect(evaluationsList).toBeVisible({ timeout: 10000 });

    // expect: Search and filter options are available
    const searchField = page.locator('input[type="text"], input[placeholder*="search"], input[placeholder*="Search"], input[placeholder*="filter"]').first();
    await expect(searchField).toBeVisible({ timeout: 5000 });
  });
});
