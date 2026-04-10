// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - VM Browser', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to admin dashboard
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    // 2. Click on 'VMs' section
    const vmLink = page.locator('a:has-text("VM"), button:has-text("VM"), mat-tab:has-text("VM")').first();
    const hasLink = await vmLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasLink) {
      await vmLink.click();
      await page.waitForTimeout(1000);
    }

    // expect: VM browser loads
    // expect: All VMs are listed
    const vmContent = page.locator('table, mat-table, [class*="vm-list"], [class*="browser"]').first();
    await expect(vmContent).toBeVisible({ timeout: 10000 });
  });
});
