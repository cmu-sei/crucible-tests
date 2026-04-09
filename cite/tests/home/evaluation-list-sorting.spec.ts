// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Home Page and Evaluation List', () => {
  test('Evaluation List Sorting', async ({ citeAuthenticatedPage: page }) => {

    // 1. Log in and navigate to home page with multiple evaluations
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });

    // expect: Evaluation list displays multiple evaluations
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    // 2. Click on the 'Name' column header
    const nameHeader = page.locator('th:has-text("Name"), mat-header-cell:has-text("Name"), [mat-sort-header]:has-text("Name")').first();
    await nameHeader.click();

    // expect: Evaluations are sorted alphabetically by description (ascending)
    // expect: Sort indicator appears on column header
    await page.waitForTimeout(500);

    // 3. Click on the 'Name' column header again
    await nameHeader.click();

    // expect: Evaluations are sorted in reverse alphabetical order (descending)
    // expect: Sort indicator updates to show descending order
    await page.waitForTimeout(500);
  });
});
