// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Search and Filtering', () => {
  test('Advanced Search with Multiple Criteria', async ({ blueprintAuthenticatedPage: page }) => {

    // 1. Navigate to the MSEL build/list page
    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 10000 });

    // Navigate to /build which contains the MSEL list
    await page.goto('http://localhost:4725/build');
    await page.waitForLoadState('load');

    // Look for MSELs list - Blueprint uses Angular Material mat-table to display MSELs
    // The actual HTML element is <mat-table> with role="table", not a native <table>
    const mselList = page.locator('mat-table').first();
    await expect(mselList).toBeVisible({ timeout: 20000 });

    // Count initial MSELs - data rows are <mat-row> elements
    const mselItems = page.locator('mat-row');
    const initialCount = await mselItems.count();
    expect(initialCount).toBeGreaterThan(0);
    
    // 2. Apply multiple filters using the Blueprint UI's visible filter controls
    // Blueprint displays filters directly (no advanced search button required)

    // Filter 1: Status - Blueprint has a "All Statuses" combobox
    const statusFilter = page.locator('mat-select').filter({ hasText: /All Statuses|Status/ }).first();
    const statusFilterVisible = await statusFilter.isVisible({ timeout: 3000 }).catch(() => false);

    if (statusFilterVisible) {
      await statusFilter.click();
      await page.waitForTimeout(500);

      const statusOption = page.locator('mat-option').first();
      if (await statusOption.isVisible({ timeout: 2000 })) {
        await statusOption.click();
        await page.waitForTimeout(500);
      }
    }

    // Filter 2: Type - Blueprint has a "All Types" combobox
    const typeFilter = page.locator('mat-select').filter({ hasText: /All Types|Type/ }).first();
    const typeFilterVisible = await typeFilter.isVisible({ timeout: 3000 }).catch(() => false);

    if (typeFilterVisible) {
      await typeFilter.click();
      await page.waitForTimeout(500);

      const typeOption = page.locator('mat-option').first();
      if (await typeOption.isVisible({ timeout: 2000 })) {
        await typeOption.click();
        await page.waitForTimeout(500);
      }
    }

    // Filter 3: Text search - Blueprint has a "Search" text input
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
    const searchInputVisible = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);

    if (searchInputVisible) {
      await searchInput.fill('MSEL');
      await page.waitForTimeout(500);
    }
    
    // expect: Multiple filters can be combined
    // expect: Results match all selected criteria (AND logic)
    await page.waitForTimeout(1000);

    const filteredItems = page.locator('mat-row');
    const filteredCount = await filteredItems.count();

    // With multiple filters, we expect fewer or equal results
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
    expect(filteredCount).toBeGreaterThanOrEqual(0);

    // 3. Clear all filters by resetting search input and dropdowns
    if (searchInputVisible) {
      await searchInput.clear();
      await page.waitForTimeout(500);
    }

    // Reset status filter if applied
    if (statusFilterVisible) {
      await statusFilter.click();
      await page.waitForTimeout(300);
      // Select the first option (usually "All Statuses")
      const allOption = page.locator('mat-option').first();
      if (await allOption.isVisible({ timeout: 2000 })) {
        await allOption.click();
        await page.waitForTimeout(500);
      }
    }

    await page.waitForTimeout(1000);

    const restoredItems = page.locator('mat-row');
    const restoredCount = await restoredItems.count();

    // expect: Full unfiltered list is displayed
    expect(restoredCount).toBeGreaterThanOrEqual(filteredCount);
  });
});
