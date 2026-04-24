// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Role and Permission Management', () => {
  test('System Roles Permission Matrix', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // 1. Navigate to admin section and click 'Roles' in the sidebar
    await page.locator('mat-list-item').filter({ hasText: 'Roles' }).getByRole('button').click();

    // expect: Roles management page loads with three tabs
    await expect(page.getByRole('tab', { name: 'Roles', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Collection Roles' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Exhibit Roles' })).toBeVisible();

    // expect: The 'Roles' tab is selected by default
    await expect(page.getByRole('tab', { name: 'Roles', exact: true, selected: true })).toBeVisible();

    // expect: A permission matrix table is displayed with role columns
    await expect(page.getByRole('columnheader', { name: 'Permissions' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Administrator' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Content Developer' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Observer' })).toBeVisible();

    // 2. Observe the permission rows
    const permissions = [
      'All', 'CreateCollections', 'ViewCollections', 'EditCollections',
      'ManageCollections', 'CreateExhibits', 'ViewExhibits', 'EditExhibits',
      'ManageExhibits', 'ViewUsers', 'ManageUsers', 'ViewRoles',
      'ManageRoles', 'ViewGroups', 'ManageGroups'
    ];

    for (const permission of permissions) {
      await expect(page.getByRole('cell', { name: permission, exact: true }).first()).toBeVisible();
    }
  });
});
