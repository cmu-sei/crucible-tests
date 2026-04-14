// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Home Page and Navigation', () => {
  test('Home Page Display', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Log in and land on home page - handled by fixture
    // expect: Home page displays with TopoMojo branding
    await expect(page).toHaveURL(/localhost:4201/);

    // expect: Navigation bar is visible at top
    const navbar = page.locator('mat-toolbar, [class*="topbar"], nav, header, [role="banner"]').first();
    await expect(navbar).toBeVisible({ timeout: 10000 });

    // expect: Workspace browser component is visible or can be opened via sidebar
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu")), [class*="hamburger"]').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
    }

    const workspaceBrowser = page.locator('[class*="workspace"], [class*="sidebar"], mat-sidenav, mat-drawer, [class*="browser"]').first();
    await expect(workspaceBrowser).toBeVisible({ timeout: 10000 });
  });
});
