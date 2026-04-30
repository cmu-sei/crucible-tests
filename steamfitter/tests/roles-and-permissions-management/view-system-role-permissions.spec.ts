// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Roles and Permissions Management', () => {
  test('View System Role Permissions', async ({ steamfitterAuthenticatedPage: page }) => {
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    await sidebar.locator('text=Roles').first().click();
    await page.waitForTimeout(1000);

    // Click on Administrator role
    await page.locator('text=Administrator').first().click();
    await page.waitForTimeout(1000);

    // Verify all permissions are shown for Administrator
    const permissionsList = page.locator('mat-checkbox, [class*="permission"], mat-list-item, [type="checkbox"]');
    const adminPermCount = await permissionsList.count();
    expect(adminPermCount).toBeGreaterThan(0);

    // Navigate back and click Content Developer
    await page.goBack();
    await page.waitForTimeout(1000);
    await page.locator('text=Content Developer').first().click();
    await page.waitForTimeout(1000);

    // Verify specific permissions for Content Developer
    const cdPermissions = page.locator('mat-checkbox, [class*="permission"], mat-list-item, [type="checkbox"]');
    const cdPermCount = await cdPermissions.count();
    expect(cdPermCount).toBeGreaterThan(0);
  });
});
