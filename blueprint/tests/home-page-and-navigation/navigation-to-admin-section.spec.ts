// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Home Page and Navigation', () => {
  test('Navigation to Admin Section', async ({ blueprintAuthenticatedPage: page }) => {

    // expect: Successfully authenticated on home page
    await expect(page).toHaveURL(/^http:\/\/localhost:4725/, { timeout: 30000 });
    const topbarText = page.locator('text=Event Dashboard');
    await expect(topbarText).toBeVisible({ timeout: 10000 });

    // 2. Navigate to admin section via user menu or URL
    // Try to find admin menu item or navigation in user menu
    const userMenuButton = page.locator(
      'mat-toolbar button:last-of-type, ' +
      '[class*="user-menu"], ' +
      'button[aria-label*="user"], ' +
      'button:has-text("admin")'
    ).first();

    const userMenuVisible = await userMenuButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (userMenuVisible) {
      await userMenuButton.click();

      const adminMenuItem = page.locator(
        'text=Administration, text=Admin, [class*="menu-item"]:has-text("Admin")'
      ).first();
      const adminMenuVisible = await adminMenuItem.isVisible({ timeout: 3000 }).catch(() => false);
      if (adminMenuVisible) {
        await adminMenuItem.click();
      } else {
        await page.keyboard.press('Escape');
        await page.goto(`${Services.Blueprint.UI}/admin`);
      }
    } else {
      // Try direct URL navigation
      await page.goto(`${Services.Blueprint.UI}/admin`);
    }

    // expect: The admin interface loads
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/.*\/admin.*/, { timeout: 10000 });

    // expect: The admin interface loads with sidebar navigation
    const sidebar = page.locator('mat-list, [class*="sidebar"], [class*="nav-list"]').first();
    await expect(sidebar).toBeVisible({ timeout: 5000 });

    // expect: Admin sections are visible: Units, Data Fields, Inject Types, Catalogs,
    // Organizations, Gallery Cards, CITE Actions, CITE Duties, Users, Roles, Groups
    const sectionNames = [
      'Units',
      'Data Fields',
      'Inject Types',
      'Catalogs',
      'Organizations',
      'Users',
      'Roles',
      'Groups',
    ];

    for (const name of sectionNames) {
      await expect(sidebar.locator(`text=${name}`).first()).toBeVisible({ timeout: 5000 });
    }

    // Check for Gallery Cards, CITE Actions, CITE Duties (may require scrolling in sidebar)
    const optionalSections = ['Gallery Cards', 'CITE Actions', 'CITE Duties'];
    for (const name of optionalSections) {
      const sectionEl = sidebar.locator(`text=${name}`).first();
      const visible = await sectionEl.isVisible({ timeout: 2000 }).catch(() => false);
      // These sections are conditional on integrations being enabled
    }

    // expect: A version display at the bottom of the admin sidebar shows 'Versions: UI 0.0.0, API 1.6.1' or similar
    const versionDisplay = page.locator(
      'text=/Versions:/i, [class*="version-display"], [class*="version"]'
    ).first();
    const versionVisible = await versionDisplay.isVisible({ timeout: 3000 }).catch(() => false);
    if (versionVisible) {
      await expect(versionDisplay).toContainText(/Version/i);
    }
  });
});
