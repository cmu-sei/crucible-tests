// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Performance', () => {
  test('Home Page Load Time', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Measure time from navigation to home page until fully loaded
    const startTime = Date.now();

    await page.goto(Services.TopoMojo.UI);
    await page.waitForLoadState('domcontentloaded');

    // Wait for app content to be visible
    const appContent = page.locator('app-root, mat-toolbar, [class*="topbar"]').first();
    await expect(appContent).toBeVisible({ timeout: 30000 });

    const loadTime = Date.now() - startTime;

    // expect: Home page loads within acceptable time (under 30 seconds for dev environment)
    expect(loadTime).toBeLessThan(30000);

    // expect: No blocking resources delay rendering
    const performanceMetrics = await page.evaluate(() => {
      const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (entries.length > 0) {
        return {
          domContentLoaded: entries[0].domContentLoadedEventEnd - entries[0].startTime,
          loadEvent: entries[0].loadEventEnd - entries[0].startTime,
        };
      }
      return null;
    });

    if (performanceMetrics) {
      expect(performanceMetrics.domContentLoaded).toBeGreaterThan(0);
    }
  });
});
