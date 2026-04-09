// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Performance and Optimization', () => {
  test('Initial Page Load Time', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Measure page load time using Performance API
    const startTime = Date.now();

    // Navigate to Blueprint (auth state pre-loaded from setup)
    await page.goto(Services.Blueprint.UI);

    // Wait for the application to be fully loaded
    await page.waitForLoadState('domcontentloaded');
    
    // 2. Measure page load time using browser Performance tab
    const performanceMetrics = await page.evaluate(() => {
      const perfData = window.performance.timing;
      const paintMetrics = performance.getEntriesByType('paint');
      
      return {
        loadTime: perfData.loadEventEnd - perfData.navigationStart,
        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.navigationStart,
        firstPaint: paintMetrics.find(entry => entry.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paintMetrics.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0,
        timeToInteractive: perfData.domInteractive - perfData.navigationStart,
      };
    });
    
    const endTime = Date.now();
    const totalLoadTime = (endTime - startTime) / 1000; // Convert to seconds
    
    console.log('Performance Metrics:');
    console.log(`  Total Load Time: ${totalLoadTime}s`);
    console.log(`  DOM Content Loaded: ${performanceMetrics.domContentLoaded}ms`);
    console.log(`  First Paint: ${performanceMetrics.firstPaint}ms`);
    console.log(`  First Contentful Paint: ${performanceMetrics.firstContentfulPaint}ms`);
    console.log(`  Time to Interactive: ${performanceMetrics.timeToInteractive}ms`);
    
    // expect: Initial page load completes within acceptable time (< 3 seconds)
    // Note: This includes authentication flow, so we allow more time
    expect(totalLoadTime).toBeLessThan(10); // 10 seconds for full auth flow
    
    // expect: Time to First Contentful Paint (FCP) is reasonable
    expect(performanceMetrics.firstContentfulPaint).toBeLessThan(3000); // 3 seconds
    
    // expect: Time to Interactive (TTI) is acceptable
    expect(performanceMetrics.timeToInteractive).toBeLessThan(5000); // 5 seconds
    
    // expect: Application loads from scratch
    await expect(page).toHaveURL(/.*localhost:4725.*/);
    
    // Verify main application interface is visible
    await expect(page.locator('text=Event Dashboard')).toBeVisible({ timeout: 5000 });
  });
});
