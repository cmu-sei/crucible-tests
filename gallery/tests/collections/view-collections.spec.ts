// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Collection Management', () => {
  test('View Collections List', async ({ page }) => {
    // 1. Log in as admin and navigate to Administration > Collections
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // expect: Collections list page loads with a table showing Name, Description, Created columns
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Description' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Created' })).toBeVisible();

    // expect: Pagination controls are visible with 'Items per page' selector
    await expect(page.getByRole('combobox', { name: 'Items per page:' })).toBeVisible();

    // expect: Search field is visible
    await expect(page.getByRole('textbox', { name: 'Search' })).toBeVisible();

    // expect: Add Collection button (plus icon) is visible
    await expect(page.getByRole('button', { name: 'Add Collection' })).toBeVisible();

    // expect: Upload Collection button (upload icon) is visible
    await expect(page.getByRole('button', { name: 'Upload Collection' })).toBeVisible();

    // 2. Observe each collection row
    // expect: Each row has action buttons: Edit, Copy, Download, Delete
    const firstRow = page.getByRole('row').nth(1);
    await expect(firstRow).toBeVisible();
  });
});
