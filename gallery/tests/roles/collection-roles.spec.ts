// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Role and Permission Management', () => {
  test('Collection Roles Tab', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // Navigate to Roles section
    await page.locator('mat-list-item').filter({ hasText: 'Roles' }).getByRole('button').click();

    // 1. Click the 'Collection Roles' tab
    await page.getByRole('tab', { name: 'Collection Roles' }).click();

    // expect: Collection Roles tab content is displayed
    // expect: A permission matrix shows Collection-level roles: Manager, Member, Observer
    await expect(page.getByRole('columnheader', { name: 'Manager' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Member' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Observer' })).toBeVisible();

    // expect: Permission rows
    await expect(page.getByRole('cell', { name: 'All', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ViewCollection', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'EditCollection', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ManageCollection', exact: true }).first()).toBeVisible();
  });
});
