// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Home Page and Navigation', () => {
  test('User Menu Administration Navigation', async ({ page }) => {
    // 1. Log in as admin user and navigate to the home page
    await authenticateWithKeycloak(page, Services.Alloy.UI);

    // expect: Home page loads successfully
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();

    // 2. Click on the user menu button in the topbar.
    //    The "Administration" item is gated on the topbar's async `canViewAdmin`
    //    permission (GET /api/me/systempermissions). The mat-menu renders its
    //    content lazily into an overlay when opened and does NOT re-render that
    //    content if the permission resolves while the menu is already open — so
    //    under parallel load the menu can open showing only Logout + Dark Theme.
    //    Close (Escape) and re-open until the item appears, so the test reflects
    //    the permission having loaded rather than racing it.
    const menuButton = page.getByRole('button', { name: 'Admin User' });
    const adminItem = page.getByRole('menuitem', { name: 'Administration' });
    await expect(async () => {
      if (await adminItem.isVisible().catch(() => false)) return;
      await page.keyboard.press('Escape');
      await expect(adminItem).toBeHidden({ timeout: 1000 });
      await menuButton.click();
      await expect(adminItem).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 30000 });

    // 3. Click on "Administration" menu item
    await adminItem.click();

    // expect: User is navigated to the admin section
    // expect: URL changes to /admin
    await expect(page).toHaveURL(/\/admin/);

    // expect: Admin interface loads with sidebar visible
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
    await expect(page.locator('mat-list').getByText('Event Templates')).toBeVisible();
    await expect(page.locator('mat-list').getByText('Events')).toBeVisible();
  });
});
