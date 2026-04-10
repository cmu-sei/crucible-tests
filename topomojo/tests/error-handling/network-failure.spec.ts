// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Network Failure Handling', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Log in successfully - handled by fixture
    // expect: User is authenticated
    await expect(page).toHaveURL(/localhost:4201/);

    // 2. Simulate network failure by blocking API requests
    await page.route('**/api/**', (route) => {
      route.abort('connectionrefused');
    });

    // 3. Attempt to perform action requiring API call
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
    }

    // expect: Application remains stable
    // expect: Error message may be displayed
    await page.waitForTimeout(3000);

    // Verify page is still responsive
    const appRoot = page.locator('app-root').first();
    const isStable = await appRoot.isVisible({ timeout: 5000 }).catch(() => false);
    expect(isStable).toBe(true);

    // Restore network
    await page.unroute('**/api/**');
  });
});
