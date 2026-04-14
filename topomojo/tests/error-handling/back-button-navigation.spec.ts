// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Browser Back Button Navigation', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate through multiple pages (home -> about)
    // expect: Navigation history is recorded
    await expect(page).toHaveURL(/localhost:4201/);

    // Navigate to about page
    await page.goto(Services.TopoMojo.UI + '/about');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/about/);

    // Navigate to admin page
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    // 2. Click browser back button
    await page.goBack();
    await page.waitForLoadState('domcontentloaded');

    // expect: User navigates back to previous page
    await expect(page).toHaveURL(/\/about/, { timeout: 10000 });

    // Go back again to home
    await page.goBack();
    await page.waitForLoadState('domcontentloaded');

    // expect: Page state is preserved or reloaded correctly
    // expect: No errors occur
    const appRoot = page.locator('app-root').first();
    await expect(appRoot).toBeVisible({ timeout: 10000 });
  });
});
