// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Home Page and Navigation', () => {
  test('Sidebar Navigation Toggle', async ({ casterAuthenticatedPage: page }) => {

    // 1. Navigate to http://localhost:4310/admin
    await page.goto(Services.Caster.UI + '/admin');

    // expect: Admin page loads with sidebar visible
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Projects').first()).toBeVisible();
    await expect(page.getByText('Users')).toBeVisible();

    // 2. Click on different sidebar items to navigate
    await page.locator('mat-list-item').filter({ hasText: 'Users' }).click();
    await expect(page).toHaveURL(/section=Users/);

    await page.locator('mat-list-item').filter({ hasText: 'Roles' }).click();
    await expect(page).toHaveURL(/section=Roles/);

    await page.locator('mat-list-item').filter({ hasText: 'Groups' }).click();
    await expect(page).toHaveURL(/section=Groups/);

    // expect: The sidebar remains visible during navigation
    await expect(page.getByText('Projects').first()).toBeVisible();

    // expect: The main content area updates based on sidebar selection
    await expect(page.getByRole('columnheader', { name: 'Group Name' })).toBeVisible();
  });
});
