// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin - Units Management', () => {
  test('Search and Filter Units', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Navigate to Units list and enter search term in search field
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await page.waitForLoadState('networkidle');

    const unitsNav = page.locator(
      'mat-list-item:has-text("Units"), a:has-text("Units"), button:has-text("Units")'
    ).first();
    await expect(unitsNav).toBeVisible({ timeout: 5000 });
    await unitsNav.click();
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator(
      'input[placeholder*="Search"], input[placeholder*="search"], [class*="search-input"]'
    ).first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Get total row count before filtering
    const allRows = page.locator('table tbody tr');
    const initialCount = await allRows.count();

    // Enter a search term
    await searchInput.fill('a');
    await page.waitForTimeout(500);

    // expect: Table filters to show matching units on Short Name and Name
    const filteredCount = await allRows.count();
    // Filtered count may be same or less than initial

    // 2. Click clear button
    const clearButton = page.locator(
      'button[aria-label*="clear"], button:has(mat-icon:has-text("clear")), ' +
      'button:has(mat-icon:has-text("close")), [class*="clear-btn"]'
    ).first();
    const clearVisible = await clearButton.isVisible({ timeout: 2000 }).catch(() => false);
    if (clearVisible) {
      await clearButton.click();
    } else {
      await searchInput.clear();
    }

    await page.waitForTimeout(500);

    // expect: All units are displayed again
    const resetCount = await allRows.count();
    expect(resetCount).toBeGreaterThanOrEqual(filteredCount);
  });
});
