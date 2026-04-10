// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('About Page', () => {
  test('About Page - Health Check Error Handling', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to About page when API health endpoint is unavailable
    // Intercept the health version endpoint to simulate failure
    await page.route('**/api/health/version', (route) => {
      route.fulfill({ status: 500, body: 'Internal Server Error' });
    });

    await page.goto(Services.TopoMojo.UI + '/about');
    await page.waitForLoadState('domcontentloaded');

    // expect: About page loads
    await expect(page).toHaveURL(/\/about/);

    // expect: Page remains functional despite version fetch failure
    const pageContent = page.locator('text=TopoMojo').first();
    await expect(pageContent).toBeVisible({ timeout: 10000 });

    // expect: Error message may be displayed for version information
    // The page should degrade gracefully
  });
});
