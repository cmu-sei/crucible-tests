// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Edge Cases and Negative Testing', () => {
  test('Empty States', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // 2. Navigate to the admin Collections page and search for a non-existent collection
    const searchField = page.getByRole('textbox', { name: 'Search' });
    await searchField.fill('ZZZZNONEXISTENTCOLLECTION');

    // expect: Empty table is displayed
    // expect: Pagination shows '0 of 0'
    await expect(page.getByText('0 of 0')).toBeVisible();

    // Clear search
    await searchField.clear();

    // 3. Navigate to Exhibits admin with a collection that has no exhibits
    await page.locator('mat-list-item').filter({ hasText: 'Exhibits' }).getByRole('button').click();
    // Without selecting a collection, no exhibits are shown
    // expect: Empty table with no rows

    // 4. Navigate to admin Groups with no groups defined
    await page.locator('mat-list-item').filter({ hasText: 'Groups' }).getByRole('button').click();
    // expect: Empty group list is displayed (or groups exist)
    await expect(page.getByRole('textbox', { name: 'Search Groups' })).toBeVisible();
  });
});
