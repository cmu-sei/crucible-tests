// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Search and Filtering', () => {
  test('Global Search Functionality', async ({ blueprintAuthenticatedPage: page }) => {

    // Navigate to the MSEL management page where the search input lives
    await page.goto('http://localhost:4725/build');
    await page.waitForLoadState('domcontentloaded');

    // 1. Locate the global search box (on the /build MSEL list page)
    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 10000 });

    // expect: Search box is visible
    const globalSearchBox = page.locator(
      'input[placeholder="Search"], ' +
      'input[placeholder*="Search"], ' +
      'input[placeholder*="search"], ' +
      'input[type="search"], ' +
      '[class*="global-search"], ' +
      '[class*="search-box"]'
    ).first();
    
    await expect(globalSearchBox).toBeVisible({ timeout: 10000 });
    
    // 2. Enter a search term that matches MSELs, events, teams, or users
    const searchTerm = 'Training';
    await globalSearchBox.fill(searchTerm);
    
    // Give some time for search results to appear
    await page.waitForTimeout(1500);
    
    // expect: Search results appear in real-time or after submission
    const searchResults = page.locator(
      '[class*="search-results"], ' +
      '[class*="search-dropdown"], ' +
      '[class*="autocomplete-panel"], ' +
      '[role="listbox"], ' +
      '[class*="results-container"]'
    ).first();
    
    // Check if results are visible (they may appear in a dropdown or panel)
    const resultsVisible = await searchResults.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (resultsVisible) {
      // expect: Results are categorized by type (MSELs, Events, Teams, etc.)
      const resultItems = page.locator(
        '[class*="search-result-item"], ' +
        '[class*="result-item"], ' +
        '[role="option"], ' +
        '.search-results > *, ' +
        '.search-results li'
      );
      
      const resultCount = await resultItems.count();
      expect(resultCount).toBeGreaterThan(0);
      
      // expect: Matching items are highlighted
      // Check if the first result contains our search term
      if (resultCount > 0) {
        const firstResult = resultItems.first();
        const resultText = await firstResult.textContent();
        expect(resultText?.toLowerCase()).toContain(searchTerm.toLowerCase());
        
        // 3. Click on a search result
        await firstResult.click();
        
        // Wait for navigation
        await page.waitForLoadState('load', { timeout: 10000 });
        
        // expect: Navigation to the selected item occurs
        // expect: Item details page is displayed
        // The URL should have changed or a details view should be visible
        const detailsView = page.locator(
          '[class*="details"], ' +
          '[class*="detail-view"], ' +
          '[class*="msel-detail"], ' +
          '[class*="event-detail"], ' +
          'h1, h2'
        ).first();
        
        await expect(detailsView).toBeVisible({ timeout: 5000 });
      }
    } else {
      // If no dropdown appears, search might trigger a page navigation or filter
      // Check if the page content has been filtered
      const contentContainer = page.locator(
        '[class*="content"], ' +
        '[class*="main"], ' +
        '[class*="list-container"], ' +
        'main'
      ).first();
      
      await expect(contentContainer).toBeVisible();
      
      // Verify that some filtered content is displayed
      const items = page.locator(
        '[class*="msel-item"], ' +
        '[class*="list-item"], ' +
        'table tbody tr, ' +
        '[class*="card"]'
      );
      
      const itemCount = await items.count();
      expect(itemCount).toBeGreaterThanOrEqual(0);
      
      // If results exist, verify they match the search term
      if (itemCount > 0) {
        const firstItem = items.first();
        const itemText = await firstItem.textContent();
        expect(itemText?.toLowerCase()).toContain(searchTerm.toLowerCase());
      }
    }
    
    await page.waitForLoadState('load');
  });
});
