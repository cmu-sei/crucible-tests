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

test.describe('Collection Management', () => {
  // Collections created by this file, tracked so `afterEach` can remove them even
  // when the test body throws partway through.
  let createdCollectionIds: string[] = [];

  test.beforeEach(() => {
    createdCollectionIds = [];
  });

  test.afterEach(async () => {
    for (const id of createdCollectionIds) {
      await apiDeleteCollectionById(id);
    }
  });

  test('View Collections List', async ({ galleryAuthenticatedPage: page }) => {
    // Seed our own row rather than depending on whatever happens to be in the
    // database — the per-row action-button assertions below need a known row.
    const seedName = `View Test Collection ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const seeded = await apiCreateCollection(seedName, 'Collection for the view-list test');
    createdCollectionIds.push(seeded.id);

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
    await searchField.fill(seedName);
    const row = page.getByRole('row').filter({ hasText: seedName });
    await expect(row).toHaveCount(1);

    // expect: Each row has action buttons: Edit, Copy, Download, Delete
    await expect(row.getByRole('button', { name: `Edit ${seedName}` })).toBeVisible();
    await expect(row.getByRole('button', { name: `Copy ${seedName}` })).toBeVisible();
    await expect(row.getByRole('button', { name: `Download ${seedName}` })).toBeVisible();
    await expect(row.getByRole('button', { name: `Delete ${seedName}` })).toBeVisible();
  });
});
