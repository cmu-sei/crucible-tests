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
  // Both the original and the expected copy name are tracked so teardown removes
  // either/both regardless of where the test body fails.
  let createdCollectionNames: string[] = [];

  test.beforeEach(() => {
    createdCollectionNames = [];
  });

  test.afterEach(async () => {
    for (const name of createdCollectionNames) {
      await apiDeleteCollectionByName(name);
    }
  });

  test('Copy Collection', async ({ galleryAuthenticatedPage: page }) => {
    const testCollectionName = `Copy Test Collection ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    // Gallery.Api CollectionService.privateCollectionCopyAsync names the copy
    // `<original name> - <current user's name>`, so the copied name is deterministic.
    const expectedCopyName = `${testCollectionName} - Admin User`;

    // Setup: seed the collection to copy via the API — the subject here is the copy action.
    createdCollectionNames.push(testCollectionName, expectedCopyName);
    await apiCreateCollection(testCollectionName, 'Collection to be copied');

    await gotoGalleryAdmin(page);

    // Search for the seeded collection (handles pagination)
    await page.getByRole('textbox', { name: 'Search' }).fill(testCollectionName);
    const matchingRows = page.getByRole('row').filter({ hasText: testCollectionName });
    await expect(matchingRows).toHaveCount(1);

    // 1. Click the Copy button (clipboard icon) on a collection row
    await matchingRows.getByRole('button', { name: `Copy ${testCollectionName}` }).click();

    // expect: A new collection is created as a copy of the original
    // expect: The copied collection appears in the list. The search filter matches on
    // name substring, so both the original and the `- Admin User` copy stay visible.
    await expect(page.getByRole('row').filter({ hasText: expectedCopyName })).toHaveCount(1);
    await expect(matchingRows).toHaveCount(2);
  });
});
