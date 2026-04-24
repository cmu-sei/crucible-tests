// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Integration and API', () => {
  const testCollectionName = `Persistence Test ${Date.now()}`;
  const updatedName = `Updated ${testCollectionName}`;

  test('Data Persistence', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // 1. Create a new collection in admin
    await page.getByRole('button', { name: 'Add Collection' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Name').fill(testCollectionName);
    await dialog.getByLabel('Description').fill('Persistence test');
    await dialog.getByRole('button', { name: 'Save' }).click();

    // expect: Collection is created and appears in the list
    await expect(page.getByText(testCollectionName)).toBeVisible();

    // 2. Refresh the page
    await page.reload();
    await expect(page).toHaveTitle('Gallery Admin');

    // expect: The created collection persists and is still displayed
    await expect(page.getByText(testCollectionName)).toBeVisible();

    // 3. Edit the collection name
    const row = page.getByRole('row').filter({ hasText: testCollectionName });
    await row.getByRole('button', { name: `Edit ${testCollectionName}` }).click();
    const editDialog = page.getByRole('dialog');
    await expect(editDialog).toBeVisible();
    await editDialog.getByLabel('Name').clear();
    await editDialog.getByLabel('Name').fill(updatedName);
    await editDialog.getByRole('button', { name: 'Save' }).click();

    // expect: Changes are saved
    await expect(page.getByText(updatedName)).toBeVisible();

    // 4. Refresh the page again
    await page.reload();
    await expect(page).toHaveTitle('Gallery Admin');

    // expect: Updated name persists
    await expect(page.getByText(updatedName)).toBeVisible();

    // 5. Delete the collection
    const updatedRow = page.getByRole('row').filter({ hasText: updatedName });
    await updatedRow.getByRole('button', { name: `Delete ${updatedName}` }).click();
    const confirmDialog = page.getByRole('dialog');
    await confirmDialog.getByRole('button', { name: /yes|confirm|ok|delete/i }).click();

    // Wait for the dialog to close
    await expect(confirmDialog).not.toBeVisible();

    // expect: Collection is removed
    await expect(page.getByText(updatedName)).not.toBeVisible();

    // 6. Refresh the page
    await page.reload();
    await expect(page).toHaveTitle('Gallery Admin');

    // expect: The deleted collection no longer appears
    await expect(page.getByText(updatedName)).not.toBeVisible();
  });
});
