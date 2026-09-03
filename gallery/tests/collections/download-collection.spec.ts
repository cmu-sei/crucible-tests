// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  gotoGalleryAdmin,
  apiCreateCollection,
  apiDeleteCollectionById,
} from '../../fixtures';
import * as fs from 'fs';

test.describe('Collection Management', () => {
  let createdCollectionIds: string[] = [];

  test.beforeEach(() => {
    createdCollectionIds = [];
  });

  test.afterEach(async () => {
    for (const id of createdCollectionIds) {
      await apiDeleteCollectionById(id);
    }
  });

  test('Download Collection as JSON', async ({ galleryAuthenticatedPage: page }) => {
    const testCollectionName = `Download Test Collection ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    // Setup: seed the collection to download via the API — the subject here is the
    // download action, not the create dialog.
    const seeded = await apiCreateCollection(testCollectionName, 'Collection for download test');
    createdCollectionIds.push(seeded.id);

    await gotoGalleryAdmin(page);

    // Search for the seeded collection (handles pagination)
    await page.getByRole('textbox', { name: 'Search' }).fill(testCollectionName);
    const row = page.getByRole('row').filter({ hasText: testCollectionName });
    await expect(row).toHaveCount(1);

    // 1. Click the Download button (download icon) on a collection row
    const downloadPromise = page.waitForEvent('download');
    await row.getByRole('button', { name: `Download ${testCollectionName}` }).click();

    // expect: A JSON file download begins
    const download = await downloadPromise;

    // expect: The filename is derived from the collection and ends in .json
    // (admin-collections.component.ts names it `<collection name>-collection.json`)
    expect(download.suggestedFilename()).toBe(`${testCollectionName}-collection.json`);

    // expect: The downloaded file contains the collection data
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const payload = JSON.parse(fs.readFileSync(downloadPath!, 'utf-8'));
    expect(payload.Collection.Id).toBe(seeded.id);
    expect(payload.Collection.Name).toBe(testCollectionName);
  });
});
