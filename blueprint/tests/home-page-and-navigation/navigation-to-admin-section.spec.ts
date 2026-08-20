// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services, serviceUrlPattern } from '../../fixtures';

/**
 * Reaching the admin section from the home page, and the integration-conditional sections.
 *
 * Tidied. Same defects as the `event-dashboard-and-navigation` spec of this name, which covers
 * the navigation itself; this one additionally pins down the conditional sidebar entries.
 *
 *   - The admin control was located as `text=Administration, text=Admin,
 *     [class*="menu-item"]:has-text("Admin")`. Playwright's `text=` engine cannot be
 *     comma-combined, so it matched **zero** elements and the spec fell through to
 *     `page.goto('/admin')`, never exercising the UI path. The real control is a
 *     `mat-menu-item` labelled "Administration" inside the topbar's user-name menu
 *     (topbar.component.html:37-51).
 *   - The `optionalSections` loop computed `visible` and then asserted **nothing** — the body
 *     was a bare comment. Those three sections are not in fact conditional on integrations:
 *     `admin-container.component.html` renders Gallery Cards, CITE Actions and CITE Duties
 *     unconditionally in the section list, so they are asserted properly here.
 *   - The version block was guarded by `if (versionVisible)` over another comma-joined `text=`
 *     locator, so it never ran. `div.app-versions` is real
 *     (admin-container.component.html:244-245).
 *   - `waitForLoadState('networkidle')` is replaced by asserting on rendered state.
 */
test.describe('Home Page and Navigation', () => {
  test('Navigation to Admin Section', async ({ blueprintAuthenticatedPage: page }) => {
    // expect: authenticated on the home page.
    await expect(page).toHaveURL(serviceUrlPattern(Services.Blueprint.UI), { timeout: 30000 });
    await expect(page.getByText('Event Dashboard').first()).toBeVisible({ timeout: 30000 });

    // 1. Open the topbar user menu and click Administration.
    const userMenuTrigger = page.locator('button.menu-trigger').first();
    await expect(userMenuTrigger).toBeVisible({ timeout: 30000 });
    await userMenuTrigger.click();

    const adminMenuItem = page.getByRole('menuitem', { name: 'Administration' });
    await expect(adminMenuItem).toBeVisible({ timeout: 15000 });
    await adminMenuItem.click();

    // expect: the admin interface loads.
    await expect(page).toHaveURL(/\/admin/, { timeout: 30000 });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({
      timeout: 30000,
    });

    const sidebar = page.locator('.appitems-container').first();
    await expect(sidebar).toBeVisible({ timeout: 30000 });

    // expect: every admin section is listed — including the three the previous version checked
    // and then discarded.
    const sectionNames = [
      'Units',
      'Data Fields',
      'Inject Types',
      'Catalogs',
      'Organizations',
      'Gallery Cards',
      'CITE Actions',
      'CITE Duties',
      'Users',
      'Roles',
      'Groups',
    ];
    for (const name of sectionNames) {
      await expect(
        sidebar.getByText(name, { exact: true }).first(),
        `admin sidebar should list "${name}"`
      ).toBeVisible({ timeout: 15000 });
    }

    // expect: the version display is present and populated.
    const versions = page.locator('.app-versions').first();
    await expect(versions).toBeVisible({ timeout: 15000 });
    await expect(versions).toHaveText(/Versions:\s*UI\s*\S+,\s*API\s*\S+/i);
  });
});
