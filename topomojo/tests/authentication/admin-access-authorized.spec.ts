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
    // Click the Admin button instead of using goto() since TopoMojo is a SPA
    const adminButton = page.getByRole('button', { name: 'Admin' });
    await expect(adminButton).toBeVisible({ timeout: 10000 });
    await adminButton.click();

    // expect: Admin page loads successfully
    await page.waitForURL(/\/admin/, { timeout: 15000 });

    // expect: Admin dashboard heading is visible
    const adminHeading = page.getByRole('heading', { name: 'Admin Dashboard' });
    await expect(adminHeading).toBeVisible({ timeout: 15000 });

    // expect: Admin navigation menu with links is visible
    const adminNavLinks = page.getByRole('link', { name: 'Dashboard' });
    await expect(adminNavLinks).toBeVisible({ timeout: 15000 });

    // expect: Admin dashboard displays
    await expect(page).toHaveURL(/\/admin/);
  });
});
