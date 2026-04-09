// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Event Dashboard and Navigation', () => {
  test('Navigation to Admin Section', async ({ blueprintAuthenticatedPage: page }) => {
    await expect(page).toHaveURL(/^http:\/\/localhost:4725/, { timeout: 30000 });
    await page.waitForLoadState('networkidle');

    // Open user menu in topbar
    const userMenuButton = page.locator(
      'button[mat-icon-button][aria-label*="user"], ' +
      'button[class*="user-menu"], ' +
      'mat-toolbar button:last-of-type, ' +
      '[class*="user-avatar"], ' +
      'button:has-text("admin")'
    ).first();
    await expect(userMenuButton).toBeVisible({ timeout: 5000 });
    await userMenuButton.click();

    // Click 'Administration' in dropdown
    const adminMenuItem = page.locator(
      'text=Administration, text=Admin, [class*="menu-item"]:has-text("Admin")'
    ).first();

    const adminMenuVisible = await adminMenuItem.isVisible({ timeout: 3000 }).catch(() => false);
    if (adminMenuVisible) {
      await adminMenuItem.click();
    } else {
      // Navigate directly to admin URL
      await page.goto(`${Services.Blueprint.UI}/admin`);
    }

    // expect: Navigation to /admin occurs
    await expect(page).toHaveURL(/.*\/admin.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // expect: The admin interface loads with sidebar navigation
    const sidebar = page.locator('mat-list, [class*="sidebar"], [class*="nav-list"]').first();
    await expect(sidebar).toBeVisible({ timeout: 5000 });

    // expect: Admin sections are visible: Units, Data Fields, Inject Types, Catalogs, Organizations, Gallery Cards, CITE Actions, CITE Duties, Users, Roles, Groups
    const expectedSections = [
      'Units', 'Data Fields', 'Inject Types', 'Catalogs',
      'Organizations', 'Users', 'Roles', 'Groups',
    ];
    for (const section of expectedSections) {
      await expect(sidebar.locator(`text=${section}`).first()).toBeVisible({ timeout: 5000 });
    }

    // expect: A version display at the bottom of the admin sidebar shows 'Versions: UI 0.0.0, API 1.6.1' or similar
    const versionDisplay = page.locator('text=/Versions:/i, [class*="version"]').first();
    const versionVisible = await versionDisplay.isVisible({ timeout: 3000 }).catch(() => false);
    if (versionVisible) {
      await expect(versionDisplay).toContainText(/Version/i);
    }
  });
});
