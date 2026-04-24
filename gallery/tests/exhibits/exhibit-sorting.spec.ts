// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Exhibit Management', () => {
  test('Exhibit List Sorting', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // Navigate to Exhibits section and select a collection
    await page.locator('mat-list-item').filter({ hasText: 'Exhibits' }).getByRole('button').click();
    const collectionDropdown = page.getByRole('combobox', { name: 'Select a Collection' });
    await collectionDropdown.click();
    await page.getByRole('option').first().click();

    // 1. Click the 'Name' column header in the exhibits table
    await page.getByRole('columnheader', { name: 'Name' }).getByRole('button').click();
    // expect: Exhibits are sorted by name

    // 2. Click the 'Created' column header
    await page.getByRole('columnheader', { name: 'Created' }).getByRole('button').click();
    // expect: Exhibits are sorted by creation date

    // 3. Click the 'User' column header
    await page.getByRole('columnheader', { name: 'User' }).getByRole('button').click();
    // expect: Exhibits are sorted by user/creator

    // 4. Click the 'Move' column header
    await page.getByRole('columnheader', { name: 'Move' }).getByRole('button').click();
    // expect: Exhibits are sorted by current move value

    // 5. Click the 'Inject' column header
    await page.getByRole('columnheader', { name: 'Inject' }).getByRole('button').click();
    // expect: Exhibits are sorted by current inject value
  });
});
