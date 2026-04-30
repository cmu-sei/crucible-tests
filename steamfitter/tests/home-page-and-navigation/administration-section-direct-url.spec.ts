// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Home Page and Navigation', () => {
  test('Administration Section Access via Direct URL', async ({ steamfitterAuthenticatedPage: page }) => {
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"], [class*="side-nav"], nav[class*="admin"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    const mainContent = page.locator('[class*="content"], main, [role="main"]').first();
    await expect(mainContent).toBeVisible({ timeout: 10000 });
  });
});
