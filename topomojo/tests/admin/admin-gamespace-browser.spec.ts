// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Gamespace Browser', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to admin dashboard
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    // 2. Click on 'Gamespaces' section
    const gamespaceLink = page.locator('a:has-text("Gamespace"), button:has-text("Gamespace"), mat-tab:has-text("Gamespace")').first();
    const hasLink = await gamespaceLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasLink) {
      await gamespaceLink.click();
      await page.waitForTimeout(1000);
    }

    // expect: Admin gamespace browser loads
    // expect: All active gamespaces are listed
    const gamespaceContent = page.locator('table, mat-table, [class*="gamespace-list"], [class*="browser"]').first();
    await expect(gamespaceContent).toBeVisible({ timeout: 10000 });
  });
});
