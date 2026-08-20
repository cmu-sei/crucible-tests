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
  // Both the seeded name and the renamed name are tracked: the test's subject is the
  // *rename*, so teardown has to be able to find the row under either name.
  let createdCollectionNames: string[] = [];

  test.beforeEach(() => {
    createdCollectionNames = [];
  });

  test.afterEach(async () => {
    for (const name of createdCollectionNames) {
      await apiDeleteCollectionByName(name);
    }
  });

  test('Edit Existing Collection', async ({ galleryAuthenticatedPage: page }) => {
    const testCollectionName = `Edit Test Collection ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const updatedName = `Updated ${testCollectionName}`;

    // Setup: seed the collection to edit via the API. The subject of this test is the
    // edit dialog, so an unrelated create-dialog regression shouldn't fail it.
    createdCollectionNames.push(testCollectionName, updatedName);
    await apiCreateCollection(testCollectionName, 'To be edited');

    await gotoGalleryAdmin(page);

    // Search for the seeded collection (handles pagination)
    const searchField = page.getByRole('textbox', { name: 'Search' });
    await searchField.fill(testCollectionName);
    const row = page.getByRole('row').filter({ hasText: testCollectionName });
    await expect(row).toHaveCount(1);

    // 1. Click the Edit button (pencil icon) on the collection row
    await row.getByRole('button', { name: `Edit ${testCollectionName}` }).click();

    // expect: Collection edit dialog opens
    const editDialog = page.getByRole('dialog');
    await expect(editDialog).toBeVisible();

    // expect: Current collection name and description are pre-populated
    await expect(editDialog.getByLabel('Name')).toHaveValue(testCollectionName);
    await expect(editDialog.getByLabel('Description')).toHaveValue('To be edited');

    // 2. Modify the collection name and description
    await editDialog.getByLabel('Name').fill(updatedName);
    await editDialog.getByLabel('Description').fill('Updated description');

    // 3. Click 'Save' button
    await editDialog.getByRole('button', { name: 'Save' }).click();
    await expect(editDialog).not.toBeVisible();

    // Search for the updated collection (handles pagination)
    await searchField.fill(updatedName);

    // expect: Collection is updated successfully
    // expect: Changes are reflected in the collections list
    const updatedRow = page.getByRole('row').filter({ hasText: updatedName });
    await expect(updatedRow).toHaveCount(1);
    await expect(updatedRow.getByRole('cell', { name: 'Updated description' })).toBeVisible();

    // expect: The pre-edit values are gone — searching the original description (which
    // is unique to the pre-edit state) returns no rows. Searching the original *name*
    // would still match, since the updated name embeds it.
    await searchField.fill('To be edited');
    await expect(page.getByRole('row').filter({ hasText: 'To be edited' })).toHaveCount(0);
  });
});
