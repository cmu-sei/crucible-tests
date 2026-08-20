// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  gotoGalleryAdmin,
  gotoAdminSection,
  createGalleryGroup,
  apiDeleteGroupByName,
} from '../../fixtures';

test.describe('Group Management', () => {
  // Three groups, so "sorted" is a claim the data can actually contradict — with
  // one or two rows every order is both ascending and descending. Names are
  // registered before the create actions and removed in afterEach.
  let groupNames: string[] = [];

  test.afterEach(async () => {
    for (const name of groupNames) {
      await apiDeleteGroupByName(name);
    }
    groupNames = [];
  });

  test('Sort Groups', async ({ galleryAuthenticatedPage: page }) => {
    await gotoGalleryAdmin(page);
    await gotoAdminSection(page, 'Groups');
    await expect(page.getByRole('columnheader', { name: 'Group Name' })).toBeVisible();

    // Setup: create three groups whose names sort A < B < C. Include a random
    // component alongside the timestamp — parallel workers can call Date.now() in
    // the same millisecond and would otherwise collide on the names.
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const [alpha, bravo, charlie] = ['A', 'B', 'C'].map((letter) => `Sort Group ${letter} ${suffix}`);
    groupNames = [alpha, bravo, charlie];

    // Created out of alphabetical order: newly created groups are appended to the
    // in-memory list, so a sorted result cannot come from insertion order.
    for (const name of [charlie, alpha, bravo]) {
      await createGalleryGroup(page, name);
    }

    // Filter to just these three rows. Other workers and the seed data also put
    // groups in this table, and asserting an exact order requires knowing exactly
    // which rows are present. The default MatTableDataSource filter matches the
    // shared suffix in the name.
    const searchField = page.getByRole('textbox', { name: 'Search Groups' });
    await searchField.fill(suffix);
    // Gallery search inputs filter on (keyup), so fill() alone sets the value
    // without applying the filter — a key event is required.
    await searchField.press('End');

    const nameCells = page.locator('app-admin-groups tr.element-row td.mat-column-name');
    await expect(nameCells).toHaveCount(3);

    // The header cell carries mat-sort-header, which renders a nested role="button"
    // around the header text; the th itself stays role="columnheader".
    const sortButton = page.getByRole('button', { name: 'Group Name' });
    const sortHeader = page.getByRole('columnheader', { name: 'Group Name' });

    // 1. Click the 'Group Name' column header
    await sortButton.click();

    // expect: Groups are sorted by name in ascending order.
    // toHaveText with an array asserts both the contents and their order.
    await expect(nameCells).toHaveText([alpha, bravo, charlie]);
    await expect(sortHeader).toHaveAttribute('aria-sort', 'ascending');

    // 2. Click the 'Group Name' column header again
    await sortButton.click();

    // expect: Groups are sorted by name in descending order
    await expect(nameCells).toHaveText([charlie, bravo, alpha]);
    await expect(sortHeader).toHaveAttribute('aria-sort', 'descending');
  });
});
