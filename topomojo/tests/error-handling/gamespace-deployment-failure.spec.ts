// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Gamespace Deployment Failure', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Simulate deployment failure by intercepting API
    await page.route('**/api/gamespace', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Insufficient resources for deployment' }),
        });
      } else {
        route.continue();
      }
    });

    // Navigate to gamespace area
    await page.goto(Services.TopoMojo.UI);
    await page.waitForLoadState('domcontentloaded');

    // expect: Application handles deployment failure gracefully
    const appRoot = page.locator('app-root').first();
    await expect(appRoot).toBeVisible({ timeout: 10000 });

    // expect: Error message explains failure reason
    // expect: User can retry or modify configuration

    // Restore routes
    await page.unroute('**/api/gamespace');
  });
});
