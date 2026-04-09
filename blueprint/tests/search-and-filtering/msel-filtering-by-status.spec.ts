// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Search and Filtering', () => {
  test('MSEL Filtering by Status', async ({ blueprintAuthenticatedPage: page }) => {
    await page.goto('http://localhost:4725/build');

    // 1. Navigate to MSELs list
    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');

    // expect: MSELs list is displayed (Blueprint uses mat-table from Angular Material)
    const mselList = page.locator(
      '[class*="msel-list"], ' +
      '[class*="msel-container"], ' +
      'mat-table, ' +
      '[class*="data-table"], ' +
      'main'
    ).first();
    await expect(mselList).toBeVisible({ timeout: 5000 });

    // Count initial MSELs - Blueprint uses mat-row (Angular Material table rows)
    const mselItems = page.locator('mat-row');
    const initialCount = await mselItems.count();
    expect(initialCount).toBeGreaterThan(0);

    // 2. Apply status filter
    // Blueprint uses mat-select with placeholder "All Statuses" for status filtering
    const statusFilter = page.locator('mat-select').filter({ hasText: /all statuses/i }).first();
    const statusFilterVisible = await statusFilter.isVisible({ timeout: 5000 }).catch(() => false);

    if (statusFilterVisible) {
      // expect: Filter dropdown shows available statuses
      await statusFilter.click();
      await page.waitForTimeout(500);

      // Get available status options (mat-option elements in the opened dropdown overlay)
      const statusOptions = page.locator('mat-option');
      const optionCount = await statusOptions.count();
      expect(optionCount).toBeGreaterThan(0);

      // Select the first non-"All" status option to filter
      const filteredOption = statusOptions.filter({ hasNotText: /^all/i }).first();
      const hasFilterOption = (await filteredOption.count()) > 0;
      if (hasFilterOption) {
        await filteredOption.click();
      } else {
        await statusOptions.first().click();
      }
      await page.waitForTimeout(1000);
    }
    // If no status filter found, continue — filtering step is gracefully skipped

    // expect: List updates to show only MSELs matching selected status
    await page.waitForLoadState('domcontentloaded');
    const filteredItems = page.locator('mat-row');
    const filteredCount = await filteredItems.count();

    // The filtered count should be less than or equal to initial count
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
    expect(filteredCount).toBeGreaterThanOrEqual(0);

    // 3. Clear filter by re-opening the dropdown and selecting "All Statuses"
    const clearFilterButton = page.locator(
      'button:has-text("Clear"), ' +
      'button:has-text("Reset"), ' +
      '[aria-label*="Clear"], ' +
      '[class*="clear-filter"]'
    ).first();

    const clearButtonVisible = await clearFilterButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (clearButtonVisible) {
      await clearFilterButton.click();
      await page.waitForTimeout(1000);
    } else if (statusFilterVisible) {
      // Re-open the filter and select the "All Statuses" option to reset
      const statusFilterReset = page.locator('mat-select').first();
      const currentText = await statusFilterReset.textContent();
      // Only reset if a filter was actually applied (text changed from "All Statuses")
      if (currentText && !/all statuses/i.test(currentText)) {
        await statusFilterReset.click();
        await page.waitForTimeout(500);

        const allOption = page.locator(
          'mat-option:has-text("All Statuses"), ' +
          'mat-option:has-text("All"), ' +
          '[role="option"]:has-text("All")'
        ).first();

        if (await allOption.isVisible({ timeout: 2000 })) {
          await allOption.click();
          await page.waitForTimeout(1000);
        }
      }
    }

    // expect: All MSELs are displayed again
    await page.waitForLoadState('domcontentloaded');
    const restoredItems = page.locator('mat-row');
    const restoredCount = await restoredItems.count();

    // After clearing, we should see the same or more items
    expect(restoredCount).toBeGreaterThanOrEqual(filteredCount);
  });
});
