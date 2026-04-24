// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Exhibit Management', () => {
  const testCollectionName = `Exhibit Download Test ${Date.now()}`;
  const testExhibitName = `Download Exhibit ${Date.now()}`;

  test('Download Exhibit as JSON', async ({ page }) => {
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

    // 1. Click the Download button (download icon) on an exhibit row
    const row = page.getByRole('row').filter({ hasText: testExhibitName });
    const downloadPromise = page.waitForEvent('download');
    await row.getByRole('button', { name: `Download ${testExhibitName}` }).click();

    // expect: A JSON file download begins
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);

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
