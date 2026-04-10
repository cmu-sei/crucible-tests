// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Authentication and Authorization', () => {
  test('Role-Based Access - Admin Access', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Log in as user with admin role (admin/admin) - handled by fixture
    // expect: User is authenticated

    // 2. Navigate to /admin route
    await page.goto(Services.TopoMojo.UI + '/admin');

    // expect: Admin page loads successfully
    await page.waitForLoadState('domcontentloaded');

    // expect: Admin navigation menu is visible
    const adminContent = page.locator('[class*="admin"], [class*="Admin"], mat-sidenav-container, mat-tab-group').first();
    await expect(adminContent).toBeVisible({ timeout: 15000 });

    // expect: Admin dashboard displays
    await expect(page).toHaveURL(/\/admin/);
  });
});
