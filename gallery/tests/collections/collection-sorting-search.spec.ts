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
import type { Page } from '@playwright/test';

/**
 * Read one column of the collections table in DOM (i.e. sorted) order.
 *
 * The table uses `multiTemplateDataRows`, so each data row is followed by a detail row;
 * `tr.element-row` selects only the data rows. Column 1 is the action-button cell, so
 * Name is column 2, Description 3, Created 4.
 *
 * Note: `rows.locator('td').nth(n)` would NOT work here — that applies `nth` across the
 * flattened set of every row's cells, not per row.
 */
async function columnValues(page: Page, columnIndex: number): Promise<string[]> {
  return page.locator(`tr.element-row td:nth-child(${columnIndex})`).allInnerTexts();
}

/**
 * Type a term into the collections Search box.
 *
 * Gallery search inputs are known to filter on `(keyup)` in some components, where
 * `fill()` alone sets the value without ever firing a key event and the list never
 * filters. `press('End')` fires a real key event (and leaves the caret/value alone),
 * so this works whichever binding the component uses.
 */
async function applySearch(page: Page, term: string): Promise<void> {
  const searchField = page.getByRole('textbox', { name: 'Search' });
  await searchField.fill(term);
  await searchField.press('End');
}

test.describe('Collection Management', () => {
  let createdCollectionIds: string[] = [];

  test.beforeEach(() => {
    createdCollectionIds = [];
  });

  // Cleanup lives here (not inline at the end of the test) so a mid-test failure still
  // removes every seeded row. Only this run's exact ids are deleted — never a name-prefix
  // purge, which would take out rows other specs are using concurrently.
  test.afterEach(async () => {
    for (const id of createdCollectionIds) {
      await apiDeleteCollectionById(id);
    }
  });

  test('Collection List Sorting and Search', async ({ galleryAuthenticatedPage: page }) => {
    // Seed a known trio so the sort assertions have deterministic data to act on and
    // the search assertion has a term guaranteed to exist and to be unique to this run
    // — no dependence on whatever else happens to be in the database.
    const marker = `SortSearch${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const names = [`${marker} Charlie`, `${marker} Alpha`, `${marker} Bravo`];
    for (const [index, name] of names.entries()) {
      const seeded = await apiCreateCollection(name, `${marker} desc ${index}`);
      createdCollectionIds.push(seeded.id);
    }

    await gotoGalleryAdmin(page);

    const dataRows = page.locator('tr.element-row');
    const searchField = page.getByRole('textbox', { name: 'Search' });

    // Narrow the (paginated) list down to just this run's rows before sorting, so the
    // column-order assertions below are not perturbed by unrelated collections.
    await applySearch(page, marker);
    await expect(dataRows).toHaveCount(names.length);

    const nameHeader = page.getByRole('columnheader', { name: 'Name' });
    const descriptionHeader = page.getByRole('columnheader', { name: 'Description' });
    const createdHeader = page.getByRole('columnheader', { name: 'Created' });

    // 1. Click the 'Name' column header in the collections table
    await nameHeader.getByRole('button').click();

    // expect: Collections are sorted by name (ascending)
    await expect
      .poll(() => columnValues(page, 2))
      .toEqual([`${marker} Alpha`, `${marker} Bravo`, `${marker} Charlie`]);

    // expect: Sort indicator is shown on the sorted column
    await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');

    // Clicking again reverses the sort direction
    await nameHeader.getByRole('button').click();
    await expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
    await expect
      .poll(() => columnValues(page, 2))
      .toEqual([`${marker} Charlie`, `${marker} Bravo`, `${marker} Alpha`]);

    // 2. Click the 'Description' column header
    await descriptionHeader.getByRole('button').click();

    // expect: Collections are sorted by description
    await expect(descriptionHeader).toHaveAttribute('aria-sort', 'ascending');
    await expect
      .poll(() => columnValues(page, 3))
      .toEqual([`${marker} desc 0`, `${marker} desc 1`, `${marker} desc 2`]);

    // 3. Click the 'Created' column header
    await createdHeader.getByRole('button').click();

    // expect: Collections are sorted by created date. They were seeded in `names`
    // order, so ascending create date restores that order.
    await expect(createdHeader).toHaveAttribute('aria-sort', 'ascending');
    await expect.poll(() => columnValues(page, 2)).toEqual(names);

    // 4. Enter a narrower search term in the Search field
    await applySearch(page, `${marker} Bravo`);

    // expect: Collections list filters to show only matching collections. Assert both
    // halves of "filters": the match survives AND the two non-matching seeded rows are
    // gone. toHaveCount(0) is used rather than not.toBeVisible() because a getByRole
    // locator that matches nothing satisfies not.toBeVisible() vacuously.
    await expect(dataRows).toHaveCount(1);
    await expect(page.getByRole('cell', { name: `${marker} Bravo`, exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: `${marker} Alpha`, exact: true })).toHaveCount(0);
    await expect(page.getByRole('cell', { name: `${marker} Charlie`, exact: true })).toHaveCount(0);

    // The paginator total reflects the filtered result set. Material pads the label with
    // whitespace, so the regex is deliberately not anchored to the end of the string.
    const paginatorStatus = page.getByRole('status');
    await expect(paginatorStatus).toHaveText(/1 – 1 of 1/);

    // 5. Clear the search field
    await page.getByRole('button', { name: 'Clear Search' }).click();
    await expect(searchField).toHaveValue('');

    // expect: All collections are displayed again. The unfiltered list paginates at 10
    // rows per page, so this run's rows are not necessarily on page 1 — assert via the
    // paginator total instead of looking for them in the visible rows. Also assert the
    // rendered row count grew past the single filtered row, which is what proves the
    // filter was actually released rather than the label merely changing. (An exact
    // count is not used: the unfiltered total depends on what else is in the database.)
    await expect.poll(() => dataRows.count()).toBeGreaterThan(names.length);
    await expect
      .poll(async () => {
        const total = (await paginatorStatus.innerText()).match(/of (\d+)/);
        return total ? Number(total[1]) : 0;
      })
      .toBeGreaterThanOrEqual(names.length);

    // Re-applying the marker filter brings all three seeded rows back.
    await applySearch(page, marker);
    await expect(dataRows).toHaveCount(names.length);
  });
});
