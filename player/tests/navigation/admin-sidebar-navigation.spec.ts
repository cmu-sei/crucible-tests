// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Navigation', () => {
  test('Admin Sidebar Navigation', async ({ playerAuthenticatedPage: page }) => {
    // 1. Navigate to admin page
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();

    // expect: Admin sidebar is visible with section links
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Views' })).toBeVisible();

    // 2. Click on different section links in sidebar
    // Click Views
    await page.getByRole('button', { name: 'Views' }).click();
    await expect(page.getByRole('heading', { name: 'Views' })).toBeVisible();

    // Click Application Templates
    await page.getByRole('button', { name: 'Application Templates' }).click();
    await expect(page).toHaveURL(/section=application-templates/);
    await expect(page.getByRole('columnheader', { name: 'Template Name' })).toBeVisible();

    // Click Users
    await page.getByRole('button', { name: 'Users Users' }).click();
    await expect(page).toHaveURL(/section=users/);
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();

    // Click Roles
    await page.getByRole('button', { name: 'Roles Roles' }).click();
    await expect(page).toHaveURL(/section=role-perm/);
    await expect(page.getByRole('tab', { name: 'Roles', exact: true })).toBeVisible();

    // Click Subscriptions
    await page.getByRole('button', { name: 'Subscriptions Subscriptions' }).click();
    await expect(page).toHaveURL(/section=subscriptions/);
    await expect(page.getByRole('columnheader', { name: 'Subscription Name' })).toBeVisible();

    // expect: Each section loads correctly
    // expect: Active section is highlighted in sidebar
  });
});
