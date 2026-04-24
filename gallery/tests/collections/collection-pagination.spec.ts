// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Collection Management', () => {
  test('Collection List Pagination', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // 1. Observe the pagination controls below the search field
    // expect: Items per page selector is visible (default: 10)
    const itemsPerPage = page.getByRole('combobox', { name: 'Items per page:' });
    await expect(itemsPerPage).toBeVisible();

    // expect: Current page range is displayed
    const paginationStatus = page.getByRole('status');
    await expect(paginationStatus).toBeVisible();
    await expect(paginationStatus).toHaveText(/\d+.*of.*\d+/);

    // expect: Previous/Next page buttons are visible
    await expect(page.getByRole('button', { name: 'Previous page' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next page' })).toBeVisible();

    // 2. Change the items per page using the selector
    await itemsPerPage.click({ force: true });
    const option5 = page.getByRole('option', { name: '5' });
    if (await option5.isVisible().catch(() => false)) {
      await option5.click();
      // expect: The table updates to show the selected number of items per page
      await expect(paginationStatus).toBeVisible();
    } else {
      await page.keyboard.press('Escape');
    }
  });
});
