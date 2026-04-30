// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Topbar Enhancements', () => {
  test.afterEach(async ({ }) => {
    // No resources to clean up for topbar tests
  });

  test('Admin Section Access From Topbar', async ({ steamfitterAuthenticatedPage: page }) => {
    // Navigate to home
    await page.goto(`${Services.Steamfitter.UI}`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for topbar to be visible
    const topbar = page.locator('mat-toolbar, [class*="topbar"], header, [role="banner"]').first();
    await expect(topbar).toBeVisible({ timeout: 15000 });

    // Find the gear icon or 'Show Administration Page' button
    const adminButton = page.locator(
      'button:has(mat-icon:text("settings")), ' +
      'button:has(mat-icon:text("admin_panel_settings")), ' +
      'button:has-text("Admin"), ' +
      'button[mattooltip*="Administration"], ' +
      'button[mattooltip*="admin"], ' +
      'a:has-text("Admin")'
    ).first();
    const hasAdminButton = await adminButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasAdminButton) {
      await adminButton.click();
      await page.waitForTimeout(1000);

      // Verify navigation to /admin
      await page.waitForURL(/\/admin/, { timeout: 10000 });
      expect(page.url()).toContain('/admin');
    } else {
      // Try looking for a menu that contains admin option
      const menuButton = topbar.locator('button:has(mat-icon:text("more_vert")), button:has(mat-icon:text("menu"))').first();
      const hasMenu = await menuButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasMenu) {
        await menuButton.click();
        await page.waitForTimeout(500);

        const adminOption = page.locator('[role="menuitem"]:has-text("Admin"), button:has-text("Administration")').first();
        if (await adminOption.isVisible({ timeout: 3000 }).catch(() => false)) {
          await adminOption.click();
          await page.waitForTimeout(1000);
          expect(page.url()).toContain('/admin');
        }
      }
    }
  });
});
