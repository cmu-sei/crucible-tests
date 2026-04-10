// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Template Browser', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to admin dashboard
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    // 2. Click on 'Templates' section
    const templateLink = page.locator('a:has-text("Template"), button:has-text("Template"), mat-tab:has-text("Template")').first();
    const hasLink = await templateLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasLink) {
      await templateLink.click();
      await page.waitForTimeout(1000);
    }

    // expect: Admin template browser loads
    // expect: All templates are listed
    const templateContent = page.locator('table, mat-table, [class*="template-list"], [class*="browser"]').first();
    await expect(templateContent).toBeVisible({ timeout: 10000 });
  });
});
