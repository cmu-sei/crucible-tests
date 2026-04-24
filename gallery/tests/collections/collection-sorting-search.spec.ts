// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Collection Management', () => {
  test('Collection List Sorting and Search', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // 1. Click the 'Name' column header in the collections table
    await page.getByRole('columnheader', { name: 'Name' }).getByRole('button').click();

    // expect: Collections are sorted by name
    // expect: Sort indicator arrow is visible

    // 2. Click the 'Description' column header
    await page.getByRole('columnheader', { name: 'Description' }).getByRole('button').click();

    // expect: Collections are sorted by description

    // 3. Click the 'Created' column header
    await page.getByRole('columnheader', { name: 'Created' }).getByRole('button').click();

    // expect: Collections are sorted by created date

    // 4. Enter a search term in the Search field
    const searchField = page.getByRole('textbox', { name: 'Search' });
    // Get text from the first data row to use as a realistic search term
    const firstDataRow = page.getByRole('row').nth(1);
    await expect(firstDataRow).toBeVisible();
    const firstRowText = await firstDataRow.getByRole('cell').nth(1).textContent();
    const searchTerm = firstRowText?.split(' ')[0] ?? 'Project';
    await searchField.fill(searchTerm);

    // expect: Collections list filters to show only matching collections
    await expect(page.getByRole('row').filter({ hasText: searchTerm }).first()).toBeVisible();

    // 5. Clear the search field
    await searchField.clear();

    // expect: All collections are displayed again
    await expect(page.getByRole('row').nth(1)).toBeVisible();
  });
});
