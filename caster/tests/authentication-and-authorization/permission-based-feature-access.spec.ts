// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Authentication and Authorization', () => {
  test('Permission-Based Feature Access', async ({ casterAuthenticatedPage: page }) => {

    // 1. Log in as a user with Content Developer role
    // expect: Successfully authenticated
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();

    // 2. Navigate to the Projects section
    // expect: Projects list is visible
    await expect(page.getByText('My Projects')).toBeVisible();

    // 3. Access the Admin section
    await page.goto(Services.Caster.UI + '/admin');

    // expect: Admin section is accessible for admin user
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 10000 });

    // expect: All admin features are available
    await expect(page.getByText('Projects').first()).toBeVisible();
    await expect(page.getByText('Users')).toBeVisible();
    await expect(page.getByText('Roles')).toBeVisible();
    await expect(page.getByText('Groups')).toBeVisible();
    await expect(page.getByText('VLANs')).toBeVisible();
    await expect(page.getByText('Modules')).toBeVisible();
    await expect(page.getByText('Workspaces')).toBeVisible();
  });
});
