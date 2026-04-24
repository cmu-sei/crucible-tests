// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Collection Management', () => {
  const testCollectionName = `Edit Test Collection ${Date.now()}`;
  const updatedName = `Updated ${testCollectionName}`;

  test('Edit Existing Collection', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // Setup: Create a collection to edit
    await page.getByRole('button', { name: 'Add Collection' }).click();
    const createDialog = page.getByRole('dialog');
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel('Name').fill(testCollectionName);
    await createDialog.getByLabel('Description').fill('To be edited');
    await createDialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(testCollectionName)).toBeVisible();

    // 1. Click the Edit button (pencil icon) on the collection row
    const row = page.getByRole('row').filter({ hasText: testCollectionName });
    await row.getByRole('button', { name: `Edit ${testCollectionName}` }).click();

    // expect: Collection edit dialog opens
    const editDialog = page.getByRole('dialog');
    await expect(editDialog).toBeVisible();

    // expect: Current collection name and description are pre-populated
    await expect(editDialog.getByLabel('Name')).toHaveValue(testCollectionName);

    // 2. Modify the collection name and description
    await editDialog.getByLabel('Name').clear();
    await editDialog.getByLabel('Name').fill(updatedName);
    await editDialog.getByLabel('Description').clear();
    await editDialog.getByLabel('Description').fill('Updated description');

    // 3. Click 'Save' button
    await editDialog.getByRole('button', { name: 'Save' }).click();

    // expect: Collection is updated successfully
    // expect: Changes are reflected in the collections list
    await expect(page.getByText(updatedName)).toBeVisible();

    // Cleanup: Delete the edited collection
    const updatedRow = page.getByRole('row').filter({ hasText: updatedName });
    await updatedRow.getByRole('button', { name: `Delete ${updatedName}` }).click();
    const confirmDialog = page.getByRole('dialog');
    await confirmDialog.getByRole('button', { name: /yes|confirm|ok|delete/i }).click();
    await expect(confirmDialog).not.toBeVisible();
    await expect(page.getByText(updatedName, { exact: true })).not.toBeVisible();
  });
});
