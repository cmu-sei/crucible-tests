// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Home Page and Navigation', () => {
  test('Navigation to Administration Section', async ({ steamfitterAuthenticatedPage: page }) => {
    const topbar = page.locator('mat-toolbar, [class*="topbar"], header, [role="banner"]').first();
    await expect(topbar).toBeVisible({ timeout: 15000 });

    const userMenu = page.locator('button:has-text("admin"), [class*="user-menu"], button:has(mat-icon:text("account_circle")), button:has(mat-icon:text("person"))').first();
    await userMenu.click();
    await page.waitForTimeout(500);

    const adminOption = page.locator('button:has-text("Administration"), a:has-text("Administration"), [class*="admin"]').first();
    await expect(adminOption).toBeVisible({ timeout: 5000 });
    await adminOption.click();

    await page.waitForURL(/\/admin/, { timeout: 15000 });

    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"], [class*="side-nav"], nav[class*="admin"]').first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  });
});
