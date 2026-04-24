// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Admin Navigation and UI', () => {
  test('Admin Sidebar Navigation', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);

    // 1. Navigate to admin section
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // expect: The admin page has a left sidebar with sections
    await expect(page.getByText('Collections').first()).toBeVisible();
    await expect(page.getByText('Exhibits').first()).toBeVisible();
    await expect(page.getByText('Users').first()).toBeVisible();
    await expect(page.getByText('Roles').first()).toBeVisible();
    await expect(page.getByText('Groups').first()).toBeVisible();

    // expect: A 'Versions: UI x.x.x, API x.x.x' label is displayed at the bottom of the sidebar
    await expect(page.getByText(/Versions: UI .+, API .+/)).toBeVisible();

    // expect: An 'Exit Administration' link with the heading 'Administration' is visible at the top
    await expect(page.getByRole('heading', { name: 'Administration', level: 2 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Administration' })).toBeVisible();

    // 2. Click 'Collections' in the sidebar
    await page.locator('mat-list-item').filter({ hasText: 'Collections' }).getByRole('button').click();
    // expect: Collections admin view loads
    await expect(page.getByRole('button', { name: 'Add Collection' })).toBeVisible();

    // 3. Click 'Exhibits' in the sidebar
    await page.locator('mat-list-item').filter({ hasText: 'Exhibits' }).getByRole('button').click();
    // expect: Exhibits admin view loads with Collection dropdown
    await expect(page.getByRole('combobox', { name: 'Select a Collection' })).toBeVisible();

    // 4. Click 'Users' in the sidebar
    await page.locator('mat-list-item').filter({ hasText: 'Users' }).getByRole('button').click();
    // expect: Users admin view loads
    await expect(page.getByRole('columnheader', { name: 'Role' })).toBeVisible();

    // 5. Click 'Roles' in the sidebar
    await page.locator('mat-list-item').filter({ hasText: 'Roles' }).getByRole('button').click();
    // expect: Roles admin view loads with three tabs
    await expect(page.getByRole('tab', { name: 'Roles', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Collection Roles' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Exhibit Roles' })).toBeVisible();

    // 6. Click 'Groups' in the sidebar
    await page.locator('mat-list-item').filter({ hasText: 'Groups' }).getByRole('button').click();
    // expect: Groups admin view loads
    await expect(page.getByRole('textbox', { name: 'Search Groups' })).toBeVisible();
  });
});
