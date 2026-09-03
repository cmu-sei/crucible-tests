// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  gotoGalleryAdmin,
  apiCreateCollection,
  apiDeleteCollectionByName,
} from '../../fixtures';

test.describe('Collection Management', () => {
  // The UI delete *is* the subject of this test, so the assertion stays in the body.
  // The afterEach is the safety net for a failure before/during the confirm step —
  // deleting an already-deleted collection is a no-op.
  let createdCollectionNames: string[] = [];

  test.beforeEach(() => {
    createdCollectionNames = [];
  });

  test.afterEach(async () => {
    for (const name of createdCollectionNames) {
      await apiDeleteCollectionByName(name);
    }
  });

  test('Delete Collection', async ({ galleryAuthenticatedPage: page }) => {
    const testCollectionName = `Delete Test Collection ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    // Setup: seed the collection to delete via the API — the create dialog is covered
    // by create-collection.spec.ts.
    createdCollectionNames.push(testCollectionName);
    await apiCreateCollection(testCollectionName, 'Collection to be deleted');

    await gotoGalleryAdmin(page);

    // Search for the seeded collection (handles pagination)
    await page.getByRole('textbox', { name: 'Search' }).fill(testCollectionName);
    const row = page.getByRole('row').filter({ hasText: testCollectionName });
    await expect(row).toHaveCount(1);

    // 1. Click the Delete button (trash icon) on a collection row
    await row.getByRole('button', { name: `Delete ${testCollectionName}` }).click();

    // expect: A confirmation dialog appears asking to confirm deletion
    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText(testCollectionName);

    // 2. Click 'Cancel' in the confirmation dialog
    await confirmDialog.getByRole('button', { name: /cancel|no/i }).click();

    // expect: Dialog closes
    await expect(confirmDialog).not.toBeVisible();

    // expect: Collection is not deleted
    await expect(row).toHaveCount(1);

    // 3. Click Delete again and confirm
    await row.getByRole('button', { name: `Delete ${testCollectionName}` }).click();
    const confirmDialog2 = page.getByRole('dialog');
    await expect(confirmDialog2).toBeVisible();
    await confirmDialog2.getByRole('button', { name: /yes|confirm|ok|delete/i }).click();

    // expect: Collection is deleted successfully
    // expect: Collection is removed from the list
    await expect(confirmDialog2).not.toBeVisible();
    await expect(row).toHaveCount(0);
  });
});
