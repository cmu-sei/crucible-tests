// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin Dashboard Access', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Log in as admin user - handled by fixture
    // 2. Navigate to /admin route
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    // expect: Admin dashboard loads
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // expect: Admin navigation menu is visible
    const adminNav = page.locator('[class*="admin"], mat-sidenav, mat-tab-group, mat-nav-list').first();
    await expect(adminNav).toBeVisible({ timeout: 15000 });

    // expect: Dashboard shows admin sections (Users, Workspaces, Gamespaces, Templates, VMs, Settings)
    const adminSections = page.locator('a:has-text("User"), a:has-text("Workspace"), a:has-text("Gamespace"), button:has-text("User"), mat-tab');
    const sectionCount = await adminSections.count();
    expect(sectionCount).toBeGreaterThan(0);
  });
});
