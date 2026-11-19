// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  gotoGalleryAdmin,
  GALLERY_THEMES,
  setGalleryTheme,
} from '../../fixtures';
import * as fs from 'fs';

for (const theme of GALLERY_THEMES) {
  test.describe(`${theme} theme › Collection Management`, () => {
    test('Download Collection as JSON', async ({ galleryAuthenticatedPage: page, seededCollection }) => {
      await setGalleryTheme(page, theme);

      await gotoGalleryAdmin(page);

      // Search for the seeded collection (handles pagination)
      await page.getByRole('textbox', { name: 'Search' }).fill(seededCollection.collectionName);
      const row = page.getByRole('row').filter({ hasText: seededCollection.collectionName });
      await expect(row).toHaveCount(1);

      // 1. Click the Download button (download icon) on a collection row
      const downloadPromise = page.waitForEvent('download');
      await row.getByRole('button', { name: `Download ${seededCollection.collectionName}` }).click();

      // expect: A JSON file download begins
      const download = await downloadPromise;

      // expect: The filename is derived from the collection and ends in .json
      // (admin-collections.component.ts names it `<collection name>-collection.json`)
      expect(download.suggestedFilename()).toBe(`${seededCollection.collectionName}-collection.json`);

      // expect: The downloaded file contains the collection data
      const downloadPath = await download.path();
      expect(downloadPath).not.toBeNull();
      const payload = JSON.parse(fs.readFileSync(downloadPath!, 'utf-8'));
      expect(payload.Collection.Id).toBe(seededCollection.collectionId);
      expect(payload.Collection.Name).toBe(seededCollection.collectionName);
    });
  });
}
