// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Exhibit Management', () => {
  const testCollectionName = `Exhibit Delete Test ${Date.now()}`;
  const testExhibitName = `Delete Exhibit ${Date.now()}`;

  test('Delete Exhibit', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // Setup: Create a collection and exhibit
    await page.getByRole('button', { name: 'Add Collection' }).click();
    const createCollDialog = page.getByRole('dialog');
    await expect(createCollDialog).toBeVisible();
    await createCollDialog.getByLabel('Name').fill(testCollectionName);
    await createCollDialog.getByRole('button', { name: 'Save' }).click();
    // Wait for dialog to close (collection is created successfully)
    await expect(createCollDialog).not.toBeVisible();

    // Navigate to Exhibits section and select the newly created collection
    await page.locator('mat-list-item').filter({ hasText: 'Exhibits' }).getByRole('button').click();
    const collectionDropdown = page.getByRole('combobox', { name: 'Select a Collection' });
    await collectionDropdown.click();
    // Wait for the collection to appear in the dropdown
    await expect(page.getByRole('option', { name: testCollectionName })).toBeVisible();
    await page.getByRole('option', { name: testCollectionName }).click();

    await page.getByRole('button', { name: 'Add Exhibit' }).click();
    const createDialog = page.getByRole('dialog');
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel('Name').fill(testExhibitName);
    await createDialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(testExhibitName)).toBeVisible();

    // 1. Click the Delete button (trash icon) on an exhibit row
    const row = page.getByRole('row').filter({ hasText: testExhibitName });
    await row.getByRole('button', { name: `Delete ${testExhibitName}` }).click();

    // expect: A confirmation dialog appears
    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();

    // 2. Click 'Cancel' in the confirmation dialog
    await confirmDialog.getByRole('button', { name: /cancel|no/i }).click();

    // expect: Dialog closes, exhibit is not deleted
    await expect(confirmDialog).not.toBeVisible();
    await expect(page.getByText(testExhibitName)).toBeVisible();

    // 3. Click Delete again and confirm
    await row.getByRole('button', { name: `Delete ${testExhibitName}` }).click();
    const confirmDialog2 = page.getByRole('dialog');
    await confirmDialog2.getByRole('button', { name: /yes|confirm|ok|delete/i }).click();

    // expect: Exhibit is deleted successfully
    await expect(page.getByText(testExhibitName)).not.toBeVisible();

    // Cleanup: Delete the collection
    await page.locator('mat-list-item').filter({ hasText: 'Collections' }).getByRole('button').click();
    // Use search to find the collection since it may not be on the first page due to pagination
    const searchBox = page.getByRole('textbox', { name: 'Search' });
    await searchBox.fill(testCollectionName);
    // Wait for search to filter results
    const collRow = page.getByRole('row').filter({ hasText: testCollectionName });
    await expect(collRow).toBeVisible();
    await collRow.getByRole('button', { name: `Delete ${testCollectionName}` }).click();
    const confirmDialog3 = page.getByRole('dialog');
    await confirmDialog3.getByRole('button', { name: /yes|confirm|ok|delete/i }).click();
    // Wait for the dialog to close and the collection to be removed from the list
    await expect(confirmDialog3).not.toBeVisible();
    await expect(collRow).not.toBeVisible();
  });
});
