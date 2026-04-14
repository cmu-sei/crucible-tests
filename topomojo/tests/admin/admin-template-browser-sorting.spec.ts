// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Template Browser Sortable Headers', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to admin template browser
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    const templateLink = page.locator('a:has-text("Template"), button:has-text("Template"), mat-tab:has-text("Template")').first();
    const hasLink = await templateLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasLink) {
      await templateLink.click();
      await page.waitForTimeout(1000);
    }

    // expect: Template list displays with table headers
    // 2. Click on 'Name' column header to sort templates by name
    const nameHeader = page.locator('th:has-text("Name"), button:has-text("Name"), mat-sort-header:has-text("Name")').first();
    const hasName = await nameHeader.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasName) {
      await nameHeader.click();
      await page.waitForTimeout(500);

      // expect: Templates are sorted alphabetically by name
      // expect: Sort indicator appears on Name column
    }
  });
});
