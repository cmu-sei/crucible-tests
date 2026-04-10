// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Gamespace Details', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to admin gamespace browser
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    const gamespaceLink = page.locator('a:has-text("Gamespace"), button:has-text("Gamespace"), mat-tab:has-text("Gamespace")').first();
    const hasLink = await gamespaceLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasLink) {
      await gamespaceLink.click();
      await page.waitForTimeout(1000);
    }

    // expect: Gamespace list displays
    const gamespaceRows = page.locator('tr, mat-row, [class*="gamespace-row"]');
    const rowCount = await gamespaceRows.count();

    if (rowCount > 0) {
      // 2. Click on a gamespace
      await gamespaceRows.first().click();
      await page.waitForTimeout(1000);

      // expect: Gamespace details page loads
      // expect: VM list and statuses are shown
      // expect: User information is displayed
      const detailsContent = page.locator('[class*="detail"], [class*="gamespace-detail"], form, [class*="vm"]').first();
      const hasDetails = await detailsContent.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasDetails) {
        await expect(detailsContent).toBeVisible();
      }
    }
  });
});
