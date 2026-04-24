// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Exhibit Management', () => {
  test('View Exhibits List', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // 1. Navigate to admin section and click 'Exhibits' in the sidebar
    await page.locator('mat-list-item').filter({ hasText: 'Exhibits' }).getByRole('button').click();

    // expect: Exhibits section loads with a 'Select a Collection' dropdown
    const collectionDropdown = page.getByRole('combobox', { name: 'Select a Collection' });
    await expect(collectionDropdown).toBeVisible();

    // 2. Select a collection from the dropdown
    await collectionDropdown.click();
    await page.getByRole('option').first().click();

    // expect: Exhibits for the selected collection are displayed in a table
    // expect: Table shows columns: Name, Created, User, Move, Inject
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Created' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'User' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Move' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Inject' })).toBeVisible();

    // expect: Add Exhibit and Upload Exhibit buttons appear in the header
    await expect(page.getByRole('button', { name: 'Add Exhibit' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload Exhibit' })).toBeVisible();
  });
});
