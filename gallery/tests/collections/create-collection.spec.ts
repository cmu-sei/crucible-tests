// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Collection Management', () => {
  const testCollectionName = `Test Collection ${Date.now()}`;

  test('Create New Collection', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // 1. Navigate to admin Collections and click the 'Add Collection' button (plus icon)
    await page.getByRole('button', { name: 'Add Collection' }).click();

    // expect: A collection creation dialog opens with form fields
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // 2. Enter a collection name and description
    await dialog.getByLabel('Name').fill(testCollectionName);
    await dialog.getByLabel('Description').fill('Automated test collection');

    // 3. Click 'Save' button
    await dialog.getByRole('button', { name: 'Save' }).click();

    // expect: Collection is created successfully
    // expect: New collection appears in the collections list
    await expect(page.getByText(testCollectionName)).toBeVisible();

    // Cleanup: Delete the created collection
    const row = page.getByRole('row').filter({ hasText: testCollectionName });
    await row.getByRole('button', { name: `Delete ${testCollectionName}` }).click();
    // Confirm deletion
    const confirmDialog = page.getByRole('dialog');
    await confirmDialog.getByRole('button', { name: /yes|confirm|ok|delete/i }).click();
    await expect(confirmDialog).not.toBeVisible();
    await expect(page.getByText(testCollectionName, { exact: true })).not.toBeVisible();
  });
});
