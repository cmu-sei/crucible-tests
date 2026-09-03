// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  gotoGalleryAdmin,
  gotoAdminSection,
  apiCreateCollection,
  apiDeleteCollectionById,
} from '../../fixtures';

const NO_MATCH_TERM = 'ZZZZNONEXISTENTCOLLECTION';

test.describe('Edge Cases and Negative Testing', () => {
  // A collection with zero exhibits is a precondition for step 3, so the spec creates
  // one rather than hoping the database contains one. Registered before the assertions
  // and deleted in afterEach.
  let emptyCollectionId: string | undefined;

  test.afterEach(async () => {
    if (emptyCollectionId) {
      await apiDeleteCollectionById(emptyCollectionId, 'Empty States exhibit-less collection');
      emptyCollectionId = undefined;
    }
  });

  test('Empty States', async ({ galleryAuthenticatedPage: page }) => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const emptyCollection = await apiCreateCollection(`ZZEmptyStates ${suffix}`);
    emptyCollectionId = emptyCollection.id;

    // 1. My Exhibits with no exhibits matching. The admin account genuinely has
    // exhibits (other specs seed them), so the empty state is reached the way a user
    // would: by filtering the list down to nothing.
    const homeSearch = page.getByRole('textbox', { name: 'Search' }).first();
    await expect(homeSearch).toBeVisible();
    await homeSearch.fill('ZZZZNOSUCHEXHIBITZZZZ');
    // home-app.component.html filters on (keyup), so fill() alone does not filter.
    await homeSearch.press('End');

    // expect: 'No results found' message is displayed in the table
    await expect(page.getByText('No results found')).toBeVisible();
    await expect(page.locator('mat-row')).toHaveCount(0);

    await gotoGalleryAdmin(page);

    // 2. Navigate to the admin Collections page and search for a non-existent collection
    const searchField = page.getByRole('textbox', { name: 'Search' });
    await searchField.fill(NO_MATCH_TERM);

    // expect: Empty table is displayed
    await expect(page.locator('app-admin-collections tr.element-row')).toHaveCount(0);

    // expect: Pagination shows '0 of 0'
    await expect(page.locator('app-admin-collections mat-paginator')).toContainText('0 of 0');

    // Clear search so the collection picker in step 3 is not affected.
    await searchField.clear();

    // 3. Navigate to Exhibits admin with a collection that has no exhibits
    await gotoAdminSection(page, 'Exhibits');
    await page.getByRole('combobox', { name: 'Select a Collection' }).click();
    const option = page.getByRole('option', { name: emptyCollection.name });
    await expect(option).toBeVisible({ timeout: 20000 });
    await option.click();

    // expect: Empty table with no rows
    // The table only renders once a collection is selected, so assert it exists and
    // then that it is empty — otherwise "no rows" would also be true of "no table".
    await expect(page.locator('app-admin-exhibits table')).toBeVisible();
    await expect(page.locator('app-admin-exhibits tr.element-row')).toHaveCount(0);

    // expect: Pagination shows '0 of 0'
    await expect(page.locator('app-admin-exhibits mat-paginator')).toContainText('0 of 0');

    // 4. Navigate to admin Groups with no groups defined.
    // Sibling specs create groups concurrently, so an unconditionally-empty list is
    // not assertable. Reach the empty state deterministically instead: filter on a
    // term no group name can contain.
    await gotoAdminSection(page, 'Groups');
    const groupSearch = page.getByRole('textbox', { name: 'Search Groups' });
    await expect(groupSearch).toBeVisible();
    await groupSearch.fill(NO_MATCH_TERM);
    // admin-groups.component.html filters on (keyup).
    await groupSearch.press('End');

    // expect: Empty group list is displayed
    await expect(page.locator('app-admin-groups tr.element-row')).toHaveCount(0);
    // The table chrome itself must survive an empty result set.
    await expect(page.getByRole('columnheader', { name: 'Group Name' })).toBeVisible();
  });
});
