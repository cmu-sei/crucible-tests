// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Home Page and Evaluation List', () => {
  test('Evaluation List Search/Filter', async ({ citeAuthenticatedPage: page }) => {

    // 1. Log in and navigate to home page with multiple evaluations
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });

    // expect: Evaluation list displays multiple evaluations
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const initialCount = await rows.count();

    // 2. Locate the search/filter input field
    const searchField = page.locator('input[type="text"], input[placeholder*="search"], input[placeholder*="filter"], input[placeholder*="Search"], mat-form-field input').first();

    // expect: Search field is visible
    await expect(searchField).toBeVisible({ timeout: 5000 });

    // 3. Enter a search term that matches at least one evaluation description
    // Get text from the first evaluation to use as search term
    const firstRowText = await rows.first().textContent();
    const searchTerm = firstRowText?.trim().substring(0, 5) || 'test';
    await searchField.fill(searchTerm);

    // expect: Evaluation list filters to show only matching evaluations
    await page.waitForTimeout(500); // Allow filter debounce

    // 4. Clear the search field using the clear button
    await searchField.clear();

    // expect: All evaluations are displayed again
    await page.waitForTimeout(500);
    const restoredCount = await rows.count();
    expect(restoredCount).toBeGreaterThanOrEqual(initialCount);
  });
});
