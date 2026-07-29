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

/**
 * Number of collections this spec seeds. Chosen so that a page size of 5 splits the
 * filtered result set across exactly two pages (5 + 1), which makes the paginator
 * range labels ("1 – 5 of 6", then "6 – 6 of 6") deterministic.
 */
const SEEDED_COUNT = 6;

test.describe('Collection Management', () => {
  let createdCollectionIds: string[] = [];

  test.beforeEach(() => {
    createdCollectionIds = [];
  });

  // Cleanup lives here (not at the end of the test body) so that a mid-test failure
  // still removes every seeded row. Only this run's exact ids are deleted — never a
  // name-prefix purge, which would take out rows other specs are using concurrently.
  test.afterEach(async () => {
    for (const id of createdCollectionIds) {
      await apiDeleteCollectionById(id);
    }
  });

  test('Collection List Pagination', async ({ galleryAuthenticatedPage: page }) => {
    // Seed a known number of collections so the range labels below are exact numbers
    // rather than "whatever happens to be in the database". Names are alphabetical by
    // suffix so that sorting on Name gives a deterministic page-1/page-2 split.
    // The random component matters: a bare Date.now() collides across parallel workers.
    const marker = `Pagination${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const suffixes = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'];
    expect(suffixes).toHaveLength(SEEDED_COUNT);

    for (const suffix of suffixes) {
      const seeded = await apiCreateCollection(`${marker} ${suffix}`, `${marker} description`);
      // Track the id immediately, before any assertion that could throw, so afterEach
      // can always clean up.
      createdCollectionIds.push(seeded.id);
    }

    // Known app race (see gallery-app-bugs.md): the home page's `loadMine()` and the
    // admin container's `load()` write to the same Akita collection store with `set()`,
    // so a slow `GET /api/my-collections` that resolves after the admin page has loaded
    // replaces the full admin list with the caller's 3-4 "my" collections (observed
    // "0 of 0" after filtering). If this spec ever flakes with a too-low row count,
    // that race is the cause — it is an app defect, not something to paper over here.
    await gotoGalleryAdmin(page);

    const itemsPerPage = page.getByRole('combobox', { name: 'Items per page:' });
    const paginatorRange = page.getByRole('status');
    const previousPage = page.getByRole('button', { name: 'Previous page' });
    const nextPage = page.getByRole('button', { name: 'Next page' });
    const dataRows = page.locator('tr.element-row');

    // 1. Observe the pagination controls below the search field
    // expect: Items per page selector is visible (default: 10)
    await expect(itemsPerPage).toBeVisible();
    await expect(itemsPerPage).toHaveText('10');

    // expect: Current page range is displayed (e.g. '1 - 6 of 6')
    await expect(paginatorRange).toBeVisible();
    // Note: a regex is matched against the raw text (Material pads the label with
    // whitespace), so this deliberately does not anchor with ^...$.
    await expect(paginatorRange).toHaveText(/\d+ – \d+ of \d+/);

    // expect: Previous/Next page buttons are visible
    await expect(previousPage).toBeVisible();
    await expect(nextPage).toBeVisible();

    // Narrow the list to just this run's rows. The unfiltered admin list holds
    // whatever other specs have seeded, so the exact counts asserted below are only
    // deterministic once the marker filter is applied.
    //
    // Gallery search inputs are known to filter on (keyup) in some components, where
    // fill() alone would not trigger the handler; press('End') guarantees a key event
    // fires regardless of which binding the component uses.
    const searchField = page.getByRole('textbox', { name: 'Search' });
    await searchField.fill(marker);
    await searchField.press('End');

    // With the default page size of 10 all six seeded rows fit on one page.
    await expect(dataRows).toHaveCount(SEEDED_COUNT);
    await expect(paginatorRange).toHaveText(`1 – ${SEEDED_COUNT} of ${SEEDED_COUNT}`);
    await expect(nextPage).toBeDisabled();
    await expect(previousPage).toBeDisabled();

    // Sort by Name ascending so the row that lands on page 2 is predictable
    // (alphabetically last: 'Foxtrot').
    const nameHeader = page.getByRole('columnheader', { name: 'Name' });
    await nameHeader.getByRole('button').click();
    await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    await expect(page.locator('tr.element-row td:nth-child(2)')).toHaveText(
      suffixes.map((suffix) => `${marker} ${suffix}`)
    );

    // 2. Change the items per page using the selector
    // The paginator's page-size mat-select cannot be clicked reliably: Material renders
    // a <div class="mat-mdc-paginator-touch-target"> over the trigger, which intercepts
    // pointer events and makes click() time out. Open the panel from the keyboard.
    await itemsPerPage.press('Enter');
    await page.getByRole('option', { name: '5', exact: true }).click();

    // expect: The table updates to show the selected number of items per page
    await expect(itemsPerPage).toHaveText('5');
    await expect(dataRows).toHaveCount(5);
    await expect(paginatorRange).toHaveText(`1 – 5 of ${SEEDED_COUNT}`);
    await expect(page.locator('tr.element-row td:nth-child(2)')).toHaveText(
      suffixes.slice(0, 5).map((suffix) => `${marker} ${suffix}`)
    );

    // The result set now spans two pages, so Next becomes actionable.
    await expect(nextPage).toBeEnabled();
    await expect(previousPage).toBeDisabled();

    // Paging forward shows the remainder and shifts the range label.
    await nextPage.click();
    await expect(dataRows).toHaveCount(SEEDED_COUNT - 5);
    await expect(paginatorRange).toHaveText(`${SEEDED_COUNT} – ${SEEDED_COUNT} of ${SEEDED_COUNT}`);
    await expect(page.locator('tr.element-row td:nth-child(2)')).toHaveText([
      `${marker} ${suffixes[SEEDED_COUNT - 1]}`,
    ]);
    await expect(nextPage).toBeDisabled();
    await expect(previousPage).toBeEnabled();

    // Paging back restores page 1.
    await previousPage.click();
    await expect(dataRows).toHaveCount(5);
    await expect(paginatorRange).toHaveText(`1 – 5 of ${SEEDED_COUNT}`);
  });
});
