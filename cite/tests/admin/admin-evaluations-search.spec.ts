// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Evaluations', () => {
  test('Evaluation Search/Filter', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to admin evaluations section with multiple evaluations
    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const evaluationsLink = page.locator('text=Evaluations, a:has-text("Evaluations"), mat-list-item:has-text("Evaluations")').first();
    await expect(evaluationsLink).toBeVisible({ timeout: 10000 });
    await evaluationsLink.click();

    // expect: Evaluations list displays multiple evaluations
    const rows = page.locator('mat-row, tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    // 2. Enter search term in search field
    const searchField = page.locator('input[type="text"], input[placeholder*="search"], input[placeholder*="Search"], input[placeholder*="filter"]').first();
    await expect(searchField).toBeVisible({ timeout: 5000 });
    await searchField.fill('test');

    // expect: Evaluations list filters to show matching evaluations only
    await page.waitForTimeout(500);

    // 3. Clear search field
    await searchField.clear();

    // expect: All evaluations are displayed again
    await page.waitForTimeout(500);
  });
});
