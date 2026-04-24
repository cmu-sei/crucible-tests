// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Exhibit Management', () => {
  const testCollectionName = `Exhibit Edit Test ${Date.now()}`;
  const testExhibitName = `Edit Exhibit ${Date.now()}`;
  const updatedExhibitName = `Updated ${testExhibitName}`;

  test('Edit Existing Exhibit', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // Setup: Create a collection and exhibit
    await page.getByRole('button', { name: 'Add Collection' }).click();
    const createCollDialog = page.getByRole('dialog');
    await expect(createCollDialog).toBeVisible();
    await createCollDialog.getByLabel('Name').fill(testCollectionName);
    await createCollDialog.getByLabel('Description').fill('Collection for exhibit edit test');
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
    // Wait for dialog to close and exhibit to appear
    await expect(createDialog).not.toBeVisible();
    await expect(page.getByText(testExhibitName)).toBeVisible();

    // 1. Click the Edit button (pencil icon) on an exhibit row
    const row = page.getByRole('row').filter({ hasText: testExhibitName });
    // Wait for the row and edit button to be fully ready
    await expect(row).toBeVisible();
    const editButton = row.getByRole('button', { name: `Edit ${testExhibitName}` });
    await expect(editButton).toBeVisible();
    await expect(editButton).toBeEnabled();
    await editButton.click();

    // expect: Exhibit edit dialog opens
    const editDialog = page.getByRole('dialog');
    await expect(editDialog).toBeVisible();

    // expect: Name is populated
    await expect(editDialog.getByLabel('Name')).toHaveValue(testExhibitName);

    // 2. Modify the exhibit name
    await editDialog.getByLabel('Name').clear();
    await editDialog.getByLabel('Name').fill(updatedExhibitName);

    // 5. Click 'Save' button
    await editDialog.getByRole('button', { name: 'Save' }).click();

    // expect: Exhibit is updated successfully
    await expect(page.getByText(updatedExhibitName)).toBeVisible();

    // Cleanup: Delete the collection (which will also remove the exhibit)
    // Note: We cannot delete the exhibit directly while the collection filter is active
    // as the delete button remains disabled. Deleting the collection will clean up everything.
    await page.locator('mat-list-item').filter({ hasText: 'Collections' }).getByRole('button').click();
    // Use search to find the collection since it may not be on the first page due to pagination
    const searchBox = page.getByRole('textbox', { name: 'Search' });
    await searchBox.fill(testCollectionName);
    // Wait for search to filter results
    const collRow = page.getByRole('row').filter({ hasText: testCollectionName });
    await expect(collRow).toBeVisible();
    await collRow.getByRole('button', { name: `Delete ${testCollectionName}` }).click();
    const confirmDialog = page.getByRole('dialog');
    await confirmDialog.getByRole('button', { name: /yes|confirm|ok|delete/i }).click();
    // Wait for the dialog to close and the collection to be removed from the list
    await expect(confirmDialog).not.toBeVisible();
    await expect(collRow).not.toBeVisible();
  });
});
