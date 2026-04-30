// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Home Page and Navigation', () => {
  test('Sidebar Navigation in Admin', async ({ steamfitterAuthenticatedPage: page }) => {
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"], [class*="side-nav"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    const expectedItems = ['Scenario Templates', 'Scenarios', 'Roles', 'Groups', 'Users'];
    for (const item of expectedItems) {
      const menuItem = sidebar.locator(`text=${item}`).first();
      await expect(menuItem).toBeVisible({ timeout: 5000 });
    }

    for (const item of expectedItems) {
      const menuItem = sidebar.locator(`text=${item}`).first();
      await menuItem.click();
      await page.waitForTimeout(500);

      await expect(sidebar).toBeVisible();
    }
  });
});
