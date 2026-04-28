// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Home Page and Navigation', () => {
  test('Navigation to Admin Section', async ({ page }) => {
    // 1. Log in as admin user
    await authenticateWithKeycloak(page, Services.Alloy.UI);

    // expect: Successfully authenticated on home page
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();

    // 2. Navigate to http://localhost:4403/admin
    await page.goto(`${Services.Alloy.UI}/admin`);

    // expect: The admin interface loads
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // expect: A sidebar navigation menu is visible on the left
    // expect: The sidebar contains sections: Event Templates, Events, Roles, Groups, Users
    await expect(page.locator('mat-list').getByText('Event Templates')).toBeVisible();
    await expect(page.locator('mat-list').getByText('Events')).toBeVisible();
    await expect(page.locator('mat-list').getByText('Users')).toBeVisible();
    await expect(page.locator('mat-list').getByText('Roles')).toBeVisible();
    await expect(page.locator('mat-list').getByText('Groups')).toBeVisible();

    // expect: The 'Event Templates' section is selected by default (in breadcrumb)
    await expect(page.getByRole('link', { name: 'Event Templates' })).toBeVisible();
  });
});
