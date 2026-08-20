// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoGalleryAdmin, apiDeleteCollectionByName } from '../../fixtures';

test.describe('Integration and API', () => {
  // Every name this spec puts into the database is registered here *before* the
  // record is created, so the afterEach safety net can remove it even when an
  // assertion in the middle of the test throws. Only exact names created by this
  // test are ever deleted — other workers create collections concurrently.
  let createdNames: string[] = [];

  test.afterEach(async () => {
    for (const name of createdNames) {
      // No-op when the collection is already gone (the happy path deletes it via UI).
      await apiDeleteCollectionByName(name);
    }
    createdNames = [];
  });

  test('Data Persistence', async ({ galleryAuthenticatedPage: page }) => {
    const testCollectionName = `Persistence Test ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const updatedName = `Updated ${testCollectionName}`;

    await gotoGalleryAdmin(page);

    // 1. Create a new collection in admin
    createdNames.push(testCollectionName);
    await page.getByRole('button', { name: 'Add Collection' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Name').fill(testCollectionName);
    await dialog.getByLabel('Description').fill('Persistence test');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).not.toBeVisible();

    // Search for the newly created collection (handles pagination)
    const searchField = page.getByRole('textbox', { name: 'Search' });
    await searchField.fill(testCollectionName);

    // expect: Collection is created and appears in the list
    await expect(page.getByText(testCollectionName)).toBeVisible();

    // 2. Refresh the page
    await page.reload();
    await expect(page).toHaveTitle('Gallery Admin');

    // Search for the collection again after reload
    await searchField.fill(testCollectionName);

    // expect: The created collection persists and is still displayed
    await expect(page.getByText(testCollectionName)).toBeVisible();

    // 3. Edit the collection name
    // Register the post-rename name too: after a successful save the record is
    // only reachable under `updatedName`, so cleanup needs both.
    createdNames.push(updatedName);
    const row = page.getByRole('row').filter({ hasText: testCollectionName });
    await row.getByRole('button', { name: `Edit ${testCollectionName}` }).click();
    const editDialog = page.getByRole('dialog');
    await expect(editDialog).toBeVisible();
    await editDialog.getByLabel('Name').clear();
    await editDialog.getByLabel('Name').fill(updatedName);
    await editDialog.getByRole('button', { name: 'Save' }).click();
    await expect(editDialog).not.toBeVisible();

    // Search for the updated collection
    await searchField.clear();
    await searchField.fill(updatedName);

    // expect: Changes are saved
    await expect(page.getByText(updatedName)).toBeVisible();

    // 4. Refresh the page again
    await page.reload();
    await expect(page).toHaveTitle('Gallery Admin');

    // Search for the updated collection again after reload
    await searchField.fill(updatedName);

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
