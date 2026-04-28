// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Roles and Permissions Management', () => {
  test('View System Roles', async ({ page }) => {
    // 1. Navigate to http://localhost:4403/admin
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // 2. Click on 'Roles' in the sidebar
    await page.locator('mat-list-item').filter({ hasText: 'Roles' }).click();

    // expect: Roles section is displayed
    await expect(page.getByRole('link', { name: 'Roles' })).toBeVisible();

    // expect: Tabs for 'Roles', 'EventTemplate Roles', and 'Event Roles' are visible
    await expect(page.getByRole('tab', { name: 'Roles', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'EventTemplate Roles', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Event Roles', exact: true })).toBeVisible();

    // expect: Roles tab is selected by default
    await expect(page.getByRole('tab', { name: 'Roles', exact: true })).toHaveAttribute('aria-selected', 'true');

    // expect: List of system-wide permissions is displayed
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'CreateEventTemplates' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ViewEventTemplates' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ManageUsers' })).toBeVisible();
  });
});
