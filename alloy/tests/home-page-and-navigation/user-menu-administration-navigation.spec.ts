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

    // 2. Click on the user menu button in the topbar
    await page.getByRole('button', { name: 'Admin User' }).click();

    // expect: User menu dropdown appears
    // expect: "Administration" menu item is visible
    await expect(page.getByRole('menuitem', { name: 'Administration' })).toBeVisible();

    // 3. Click on "Administration" menu item
    await page.getByRole('menuitem', { name: 'Administration' }).click();

    // expect: User is navigated to the admin section
    // expect: URL changes to /admin
    await expect(page).toHaveURL(/\/admin/);

    // expect: Admin interface loads with sidebar visible
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
    await expect(page.locator('mat-list').getByText('Event Templates')).toBeVisible();
    await expect(page.locator('mat-list').getByText('Events')).toBeVisible();
  });
});
