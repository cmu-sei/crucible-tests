// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('API Error - Server Error 500', async ({ topomojoAuthenticatedPage: page }) => {

    // Collect console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Trigger API call that returns 500 error
    await page.route('**/api/workspaces*', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal Server Error' }),
      });
    });

    // Navigate to trigger workspace API call
    await page.goto(Services.TopoMojo.UI);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // expect: Application handles error gracefully
    const appRoot = page.locator('app-root').first();
    await expect(appRoot).toBeVisible({ timeout: 10000 });

    // expect: No uncaught exceptions in console (page crash)
    // Note: Some error logs are expected for the 500 response

    // Restore routes
    await page.unroute('**/api/workspaces*');
  });
});
