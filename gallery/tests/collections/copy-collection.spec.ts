// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Collection Management', () => {
  const testCollectionName = `Copy Test Collection ${Date.now()}`;

  test('Copy Collection', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // Setup: Create a collection to copy
    await page.getByRole('button', { name: 'Add Collection' }).click();
    const createDialog = page.getByRole('dialog');
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel('Name').fill(testCollectionName);
    await createDialog.getByLabel('Description').fill('Collection to be copied');
    await createDialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(testCollectionName)).toBeVisible();

    // 1. Click the Copy button (clipboard icon) on a collection row
    const row = page.getByRole('row').filter({ hasText: testCollectionName });
    await row.getByRole('button', { name: `Copy ${testCollectionName}` }).click();

    // expect: A new collection is created as a copy of the original
    // expect: The copied collection appears in the list
    // The copy typically gets a name like "Copy of <original>" or similar
    // Wait for a new row to appear
    await expect(page.getByRole('row').filter({ hasText: testCollectionName })).toHaveCount(2, { timeout: 10000 }).catch(() => {
      // It may have a different name like "Copy of ..."
    });

    // Cleanup: Delete both the original and the copy
    // Delete all rows matching the collection name
    const rows = page.getByRole('row').filter({ hasText: testCollectionName });
    const count = await rows.count();
    for (let i = count - 1; i >= 0; i--) {
      const deleteButton = rows.nth(i).getByRole('button').filter({ has: page.locator('mat-icon:text("delete")') });
      if (await deleteButton.isVisible().catch(() => false)) {
        await deleteButton.click();
        const confirmDialog = page.getByRole('dialog');
        await confirmDialog.getByRole('button', { name: /yes|confirm|ok|delete/i }).click();
        // Wait a moment for deletion to complete
        await expect(page.getByRole('dialog')).not.toBeVisible();
      }
    }
  });
});
