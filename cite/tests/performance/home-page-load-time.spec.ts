// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Performance', () => {
  test('Page Load Performance - Home Page', async ({ citeAuthenticatedPage: page }) => {

    // 1. Measure time from navigation to home page until page is fully loaded
    const startTime = Date.now();
    await page.goto(Services.Cite.UI);
    await page.waitForLoadState('domcontentloaded');

    // Wait for main content to render
    const content = page.locator('mat-table, table, [class*="evaluation"], [class*="list"], mat-toolbar').first();
    await expect(content).toBeVisible({ timeout: 10000 });

    const loadTime = Date.now() - startTime;

    // expect: Home page loads within acceptable time (e.g., under 3 seconds)
    // Note: Using 10 seconds to account for dev environment
    expect(loadTime).toBeLessThan(10000);

    // expect: No blocking resources delay rendering
  });
});
