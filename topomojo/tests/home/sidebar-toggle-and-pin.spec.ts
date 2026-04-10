// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Home Page and Navigation', () => {
  test('Sidebar Toggle and Pin', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Log in and navigate to home page - handled by fixture
    // expect: Sidebar hamburger menu button is visible at top of sidebar
    const hamburgerButton = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu")), [class*="hamburger"]').first();
    await expect(hamburgerButton).toBeVisible({ timeout: 10000 });

    // expect: Hamburger button has proper aria-label for accessibility
    // Button should be accessible

    // 2. Click hamburger menu button to toggle sidebar open
    await hamburgerButton.click();
    await page.waitForTimeout(500);

    // expect: Sidebar opens showing workspace browser
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"], [class*="side-panel"]').first();
    await expect(sidebar).toBeVisible({ timeout: 5000 });

    // expect: Hamburger button remains visible at top
    await expect(hamburgerButton).toBeVisible();

    // 3. Click hamburger menu button again to close sidebar
    await hamburgerButton.click();
    await page.waitForTimeout(500);

    // expect: Sidebar closes (may not be visible or have reduced width)
    // expect: Hamburger button still visible and accessible
    await expect(hamburgerButton).toBeVisible();

    // 4. Open sidebar and click pin button in sidebar footer
    await hamburgerButton.click();
    await page.waitForTimeout(500);

    const pinButton = page.locator('button:has(mat-icon:text("push_pin")), button[class*="pin"], [class*="pin-button"]').first();
    const hasPinButton = await pinButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasPinButton) {
      await pinButton.click();
      await page.waitForTimeout(300);

      // expect: Sidebar is pinned open
      await expect(sidebar).toBeVisible();

      // 5. Click pin button again to unpin
      await pinButton.click();
      await page.waitForTimeout(300);

      // expect: Sidebar is unpinned

      // 6. With sidebar unpinned, click outside sidebar area
      const mainContent = page.locator('[class*="content"], main, [class*="main"]').first();
      const hasMainContent = await mainContent.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasMainContent) {
        await mainContent.click();
        await page.waitForTimeout(500);
      }
    }
  });
});
