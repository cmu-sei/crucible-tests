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

for (const theme of GALLERY_THEMES) {
  test.describe(`${theme} theme › Collection Management`, () => {
    test('View Collections List', async ({ galleryAuthenticatedPage: page, seededCollection }) => {
      await setGalleryTheme(page, theme);

      // 1. Log in as admin and navigate to Administration > Collections
      await gotoGalleryAdmin(page);

      // expect: Collections list page loads with a table showing Name, Description, Created columns
      await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Description' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Created' })).toBeVisible();

      // expect: Pagination controls are visible with 'Items per page' selector
      await expect(page.getByRole('combobox', { name: 'Items per page:' })).toBeVisible();

      // expect: Search field is visible
      const searchField = page.getByRole('textbox', { name: 'Search' });
      await expect(searchField).toBeVisible();

      // expect: Add Collection button (plus icon) is visible
      await expect(page.getByRole('button', { name: 'Add Collection' })).toBeVisible();

      // expect: Upload Collection button (upload icon) is visible
      await expect(page.getByRole('button', { name: 'Upload Collection' })).toBeVisible();

      // 2. Observe each collection row
      // The admin list paginates, so filter down to the seeded row first instead of
      // scanning page 1.
      await searchField.fill(seededCollection.collectionName);
      const row = page.getByRole('row').filter({ hasText: seededCollection.collectionName });
      await expect(row).toHaveCount(1);

      // expect: Each row has action buttons: Edit, Copy, Download, Delete
      await expect(row.getByRole('button', { name: `Edit ${seededCollection.collectionName}` })).toBeVisible();
      await expect(row.getByRole('button', { name: `Copy ${seededCollection.collectionName}` })).toBeVisible();
      await expect(row.getByRole('button', { name: `Download ${seededCollection.collectionName}` })).toBeVisible();
      await expect(row.getByRole('button', { name: `Delete ${seededCollection.collectionName}` })).toBeVisible();
    });
  });
}
