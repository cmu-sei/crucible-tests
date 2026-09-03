// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services, serviceUrlPattern, openBlueprintUserMenu } from '../../fixtures';

/**
 * Reaching the admin section from the dashboard, and what it must render on arrival.
 *
 * Tidied. The previous version worked, but only by accident and with three fixed/idle waits:
 *
 *   - It looked for the admin control as `text=Administration, text=Admin,
 *     [class*="menu-item"]:has-text("Admin")`. Playwright's `text=` engine cannot be
 *     comma-combined, so that locator matched **zero** elements; the spec then silently took
 *     its `else` branch and navigated to `/admin` directly. The UI control was never exercised.
 *     It is a `mat-menu-item` labelled "Administration" inside the menu opened by the
 *     user-name button in the topbar (topbar.component.html:37-51) -- the dashboard itself
 *     renders no Administration button, so it has to be opened first.
 *   - The version assertion was wrapped in `if (versionVisible)` over the same broken
 *     comma-joined locator, so it never ran. The element is real:
 *     `admin-container.component.html:244-245` renders
 *     `Versions: UI {{ uiVersion }}, API {{ apiVersion }}` in `div.app-versions`.
 *   - Three `waitForLoadState('networkidle')` calls stood in for waiting on rendered state.
 *     Each is replaced by an assertion on what should actually be on screen.
 */
test.describe('Event Dashboard and Navigation', () => {
  test('Navigation to Admin Section', async ({ blueprintAuthenticatedPage: page }) => {
    await expect(page).toHaveURL(serviceUrlPattern(Services.Blueprint.UI), { timeout: 30000 });

    // 1. Open the topbar user menu, then click Administration — the real control path.
    // The Administration item is permission-gated on `canViewAdmin`, which TopbarComponent
    // (OnPush, plain property) assigns from an async `permissionDataService.load()`
    // subscription. A panel opened before that resolves never gains the item, however long
    // it is waited on, so openBlueprintUserMenu reopens the menu until the item is there.
    const userMenuTrigger = page.locator('button.menu-trigger').first();
    await expect(userMenuTrigger).toBeVisible({ timeout: 30000 });
    await openBlueprintUserMenu(page, userMenuTrigger);

    await page.getByRole('menuitem', { name: 'Administration' }).click();

    // expect: navigation to /admin occurs.
    await expect(page).toHaveURL(/\/admin/, { timeout: 30000 });

    // expect: the admin shell has rendered.
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({
      timeout: 30000,
    });

    // expect: the sidebar lists every admin section. Waiting on these replaces the idle waits —
    // if the sidebar has not rendered, this is what fails.
    const sidebar = page.locator('.appitems-container').first();
    await expect(sidebar).toBeVisible({ timeout: 30000 });

    const expectedSections = [
      'Units',
      'Data Fields',
      'Inject Types',
      'Catalogs',
      'Organizations',
      'Users',
      'Roles',
      'Groups',
    ];
    for (const section of expectedSections) {
      await expect(
        sidebar.getByText(section, { exact: true }).first(),
        `admin sidebar should list "${section}"`
      ).toBeVisible({ timeout: 15000 });
    }

    // expect: the sidebar's version display is present and populated — asserted
    // unconditionally, unlike the previous `if (versionVisible)` guard.
    const versions = page.locator('.app-versions').first();
    await expect(versions).toBeVisible({ timeout: 15000 });
    await expect(versions).toHaveText(/Versions:\s*UI\s*\S+,\s*API\s*\S+/i);
  });
});
