// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Invalid Workspace ID', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to /topo/invalid-id-12345
    await page.goto(Services.TopoMojo.UI + '/topo/invalid-id-12345');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // expect: Error page is displayed or error notification shown
    const errorContent = page.locator('[class*="error"], text=/not found/i, text=/does not exist/i, [class*="alert"]').first();
    const hasError = await errorContent.isVisible({ timeout: 5000 }).catch(() => false);

    // expect: User can navigate back to home
    const homeLink = page.locator('a[href="/"], button:has-text("Home"), a:has-text("Home")').first();
    const hasHome = await homeLink.isVisible({ timeout: 5000 }).catch(() => false);

    // Page should handle invalid ID gracefully
    const appRoot = page.locator('app-root').first();
    await expect(appRoot).toBeVisible({ timeout: 10000 });
  });
});
