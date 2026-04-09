// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Performance and Optimization', () => {
  test.beforeEach(async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to Blueprint application (auth state pre-loaded from setup)
    await page.goto(Services.Blueprint.UI);
    await page.waitForLoadState('domcontentloaded');
  });

  test('Subsequent Page Load Time', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. After initial load, navigate to different sections

    // Measure navigation to Build (MSEL management) page
    let startTime = Date.now();
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('load');
    await expect(page.locator('text=Blueprint - Collaborative MSEL Creation')).toBeVisible({ timeout: 5000 });
    let endTime = Date.now();
    let navigationTime = (endTime - startTime) / 1000;

    console.log(`Navigation to Build page: ${navigationTime}s`);

    // expect: Page transitions are reasonably fast
    expect(navigationTime).toBeLessThan(5); // 5 seconds is reasonable for a full page load

    // Navigate to Admin section
    startTime = Date.now();
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await page.waitForLoadState('load');
    endTime = Date.now();
    navigationTime = (endTime - startTime) / 1000;

    console.log(`Navigation to Admin: ${navigationTime}s`);
    expect(navigationTime).toBeLessThan(5);

    // Navigate back to home
    startTime = Date.now();
    await page.goto(Services.Blueprint.UI);
    await page.waitForLoadState('load');
    await expect(page.locator('text=Event Dashboard')).toBeVisible({ timeout: 5000 });
    endTime = Date.now();
    navigationTime = (endTime - startTime) / 1000;

    console.log(`Navigation to Home: ${navigationTime}s`);
    expect(navigationTime).toBeLessThan(5);

    // 2. Measure page transition times
    // Navigate to build page again (should use cached resources)
    startTime = Date.now();
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('load');
    await expect(page.locator('text=Blueprint - Collaborative MSEL Creation')).toBeVisible({ timeout: 5000 });
    endTime = Date.now();
    const cachedLoadTime = (endTime - startTime) / 1000;

    console.log(`Second navigation to Build (cached): ${cachedLoadTime}s`);

    // expect: Cached resources are utilized
    // expect: Lazy loading is used appropriately
    // Second load should be faster than first load
    expect(cachedLoadTime).toBeLessThan(3); // Should be faster with cache
    
    // Check that resources are cached
    const performanceEntries = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const cachedResources = entries.filter(entry => 
        entry.transferSize === 0 || entry.transferSize < entry.encodedBodySize
      );
      return {
        total: entries.length,
        cached: cachedResources.length,
        cacheRatio: cachedResources.length / entries.length
      };
    });
    
    console.log(`Resource Cache Ratio: ${(performanceEntries.cacheRatio * 100).toFixed(1)}%`);
    
    // Expect at least some resources to be cached
    expect(performanceEntries.cached).toBeGreaterThan(0);
  });
});
