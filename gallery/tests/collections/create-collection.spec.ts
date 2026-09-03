// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  gotoGalleryAdmin,
  apiDeleteCollectionByName,
} from '../../fixtures';

test.describe('Collection Management', () => {
  // Names this test asked the UI to create. Registered *before* the create action so
  // a mid-create failure still gets cleaned up.
  let createdCollectionNames: string[] = [];

  test.beforeEach(() => {
    createdCollectionNames = [];
  });

  test.afterEach(async () => {
    for (const name of createdCollectionNames) {
      await apiDeleteCollectionByName(name);
    }
  });

  test('Create New Collection', async ({ galleryAuthenticatedPage: page }) => {
    const testCollectionName = `Test Collection ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    await gotoGalleryAdmin(page);

    // 1. Navigate to admin Collections and click the 'Add Collection' button (plus icon)
    await page.getByRole('button', { name: 'Add Collection' }).click();

    // expect: A collection creation dialog opens with form fields
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // 2. Enter a collection name and description
    // Register the name before saving so teardown covers a partial create.
    createdCollectionNames.push(testCollectionName);
    await dialog.getByLabel('Name').fill(testCollectionName);
    await dialog.getByLabel('Description').fill('Automated test collection');

    // 3. Click 'Save' button
    await dialog.getByRole('button', { name: 'Save' }).click();

    // expect: Collection is created successfully
    // expect: Dialog closes
    await expect(dialog).not.toBeVisible();

    // Search for the newly created collection (handles pagination if >10 collections exist)
    await page.getByRole('textbox', { name: 'Search' }).fill(testCollectionName);

    // expect: New collection appears in the collections list
    const row = page.getByRole('row').filter({ hasText: testCollectionName });
    await expect(row).toHaveCount(1);
    await expect(row.getByRole('cell', { name: 'Automated test collection' })).toBeVisible();
  });
});
