// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Exhibit Management', () => {
  const testCollectionName = `Exhibit Create Test ${Date.now()}`;
  const testExhibitName = `Test Exhibit ${Date.now()}`;

  test('Create New Exhibit', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // Setup: Create a collection for the exhibit
    await page.getByRole('button', { name: 'Add Collection' }).click();
    const createCollDialog = page.getByRole('dialog');
    await expect(createCollDialog).toBeVisible();
    await createCollDialog.getByLabel('Name').fill(testCollectionName);
    await createCollDialog.getByLabel('Description').fill('Collection for exhibit test');
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

    // 1. Click 'Add Exhibit' button
    await page.getByRole('button', { name: 'Add Exhibit' }).click();

    // expect: An exhibit creation dialog opens with form fields
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // 2. Enter an exhibit name and description
    await dialog.getByLabel('Name').fill(testExhibitName);

    // 6. Click 'Save' button
    await dialog.getByRole('button', { name: 'Save' }).click();

    // expect: Exhibit is created successfully
    // expect: New exhibit appears in the list
    await expect(page.getByText(testExhibitName)).toBeVisible();

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
