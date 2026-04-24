// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Collection Management', () => {
  const testCollectionName = `Delete Test Collection ${Date.now()}`;

  test('Delete Collection', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // Setup: Create a collection to delete
    await page.getByRole('button', { name: 'Add Collection' }).click();
    const createDialog = page.getByRole('dialog');
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel('Name').fill(testCollectionName);
    await createDialog.getByLabel('Description').fill('Collection to be deleted');
    await createDialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(testCollectionName)).toBeVisible();

    // 1. Click the Delete button (trash icon) on a collection row
    const row = page.getByRole('row').filter({ hasText: testCollectionName });
    await row.getByRole('button', { name: `Delete ${testCollectionName}` }).click();

    // expect: A confirmation dialog appears asking to confirm deletion
    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();

    // 2. Click 'Cancel' in the confirmation dialog
    await confirmDialog.getByRole('button', { name: /cancel|no/i }).click();

    // expect: Dialog closes
    await expect(confirmDialog).not.toBeVisible();

    // expect: Collection is not deleted
    await expect(page.getByText(testCollectionName)).toBeVisible();

    // 3. Click Delete again and confirm
    await row.getByRole('button', { name: `Delete ${testCollectionName}` }).click();
    const confirmDialog2 = page.getByRole('dialog');
    await expect(confirmDialog2).toBeVisible();
    await confirmDialog2.getByRole('button', { name: /yes|confirm|ok|delete/i }).click();

    // expect: Collection is deleted successfully
    // expect: Collection is removed from the list
    await expect(confirmDialog2).not.toBeVisible();
    await expect(page.getByText(testCollectionName, { exact: true })).not.toBeVisible();
  });
});
