// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('User Management', () => {
  test('User Search and Pagination', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // Navigate to Users section
    await page.locator('mat-list-item').filter({ hasText: 'Users' }).getByRole('button').click();

    const searchField = page.getByRole('textbox', { name: 'Search' });

    // 1. Enter a search term in the Search field
    await searchField.fill('Admin');

    // expect: User list filters to show only matching users
    await expect(page.getByRole('row').filter({ hasText: 'Admin User' }).first()).toBeVisible();

    // 2. Clear the search field
    await searchField.clear();

    // expect: All users are displayed again

    // 3. Observe the 'Items per page' selector
    const itemsPerPage = page.getByRole('combobox', { name: 'Items per page:' });
    await expect(itemsPerPage).toBeVisible();
  });
});
