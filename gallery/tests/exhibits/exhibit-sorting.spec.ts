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
  apiCreateExhibit,
  apiDeleteCollectionById,
} from '../../fixtures';
import type { Page } from '@playwright/test';

const SORTABLE_COLUMNS = ['Name', 'Created', 'User', 'Move', 'Inject'];

async function selectCollection(page: Page, collectionName: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Select a Collection' }).click();
  const option = page.getByRole('option', { name: collectionName });
  await expect(option).toBeVisible({ timeout: 20000 });
  await option.click();
}

/** Read the Name column (2nd cell; the 1st holds the row action buttons) of every data row. */
async function exhibitNameColumn(page: Page): Promise<string[]> {
  const cells = page.locator('tr.element-row td:nth-child(2)');
  return (await cells.allTextContents()).map((t) => t.trim());
}

test.describe('Exhibit Management', () => {
  // Registered as soon as the collection exists so `afterEach` removes it even when
  // the test body throws partway through.
  let collectionId: string | undefined;

  test.afterEach(async () => {
    // Exhibit.CollectionId is configured with DeleteBehavior.Cascade, so deleting the
    // collection also deletes every exhibit in it.
    if (collectionId) {
      await apiDeleteCollectionById(collectionId, 'Exhibit Sorting Test collection');
    }
    collectionId = undefined;
  });

  /**
   * Seed a collection holding three exhibits whose names sort differently from their
   * creation order, so a name sort and a date sort are distinguishable.
   */
  async function seedSortableExhibits(): Promise<{ collectionName: string; namesInCreationOrder: string[] }> {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const collection = await apiCreateCollection(`Exhibit Sorting Test ${suffix}`);
    collectionId = collection.id;

    const namesInCreationOrder = [
      `Sort Exhibit C ${suffix}`,
      `Sort Exhibit A ${suffix}`,
      `Sort Exhibit B ${suffix}`,
    ];
    for (const name of namesInCreationOrder) {
      await apiCreateExhibit(collectionId, name);
    }
    return { collectionName: collection.name, namesInCreationOrder };
  }

  /**
   * The Exhibits table paginates at [pageSize]="10", so a 3-exhibit collection (as
   * `seedSortableExhibits` above creates) never exercises the paginator. Seed 12
   * exhibits instead, named so that name-ascending order, name-descending order, and
   * creation-date order each split across the 10/2 page boundary differently — proving
   * the paginator and the sort are both really re-slicing the data, not coincidentally
   * agreeing with each other.
   *
   * Letters are a permutation of A-L: alphabetical order is exactly A..L, but the
   * creation order below is scrambled, so "sorted by name" and "sorted by date" name
   * different rows as page 1 vs. page 2.
   */
  const PAGINATED_LETTERS_IN_CREATION_ORDER = ['C', 'A', 'B', 'F', 'D', 'E', 'I', 'G', 'H', 'L', 'J', 'K'];

  async function seedPaginatedSortableExhibits(): Promise<{
    collectionName: string;
    namesInCreationOrder: string[];
  }> {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const collection = await apiCreateCollection(`Exhibit Sorting Pagination Test ${suffix}`);
    collectionId = collection.id;

    const namesInCreationOrder = PAGINATED_LETTERS_IN_CREATION_ORDER.map(
      (letter) => `Sort Exhibit ${letter} ${suffix}`
    );
    for (const name of namesInCreationOrder) {
      await apiCreateExhibit(collectionId, name);
    }
    return { collectionName: collection.name, namesInCreationOrder };
  }

  test('Exhibit List Sorting - headers respond to clicks', async ({ galleryAuthenticatedPage: page }) => {
    const { collectionName, namesInCreationOrder } = await seedSortableExhibits();

    await gotoGalleryAdmin(page);
    await gotoAdminSection(page, 'Exhibits');
    await selectCollection(page, collectionName);

    // All three seeded exhibits must be on screen before sorting means anything.
    await expect(page.locator('tr.element-row')).toHaveCount(namesInCreationOrder.length);

    // Every documented column is a real, clickable MatSort header, and clicking it
    // advances the sort state ascending -> descending -> none. The row-reordering
    // effect of each click is asserted separately below.
    for (const column of SORTABLE_COLUMNS) {
      const header = page.getByRole('columnheader', { name: column });
      const headerButton = header.getByRole('button');
      await expect(headerButton).toBeVisible();

      await headerButton.click();
      await expect(header).toHaveAttribute('aria-sort', 'ascending');

      await headerButton.click();
      await expect(header).toHaveAttribute('aria-sort', 'descending');

      await headerButton.click();
      await expect(header).toHaveAttribute('aria-sort', 'none');

      // Sorting must never drop or duplicate rows.
      expect((await exhibitNameColumn(page)).sort()).toEqual([...namesInCreationOrder].sort());
    }
  });

  test('Exhibit List Sorting - rows reorder by column', async ({ galleryAuthenticatedPage: page }) => {
    const { collectionName, namesInCreationOrder } = await seedSortableExhibits();
    const ascendingByName = [...namesInCreationOrder].sort();

    await gotoGalleryAdmin(page);
    await gotoAdminSection(page, 'Exhibits');
    await selectCollection(page, collectionName);
    await expect(page.locator('tr.element-row')).toHaveCount(namesInCreationOrder.length);

    // 1. Click the 'Name' column header in the exhibits table
    const nameHeader = page.getByRole('columnheader', { name: 'Name' }).getByRole('button');
    await nameHeader.click();

    // expect: Exhibits are sorted by name (ascending on the first click)
    await expect.poll(() => exhibitNameColumn(page), { timeout: 10000 }).toEqual(ascendingByName);

    // Clicking again reverses the sort direction.
    await nameHeader.click();
    await expect
      .poll(() => exhibitNameColumn(page), { timeout: 10000 })
      .toEqual([...ascendingByName].reverse());

    // 2. Click the 'Created' column header
    await page.getByRole('columnheader', { name: 'Created' }).getByRole('button').click();

    // expect: Exhibits are sorted by creation date. They were seeded in
    // `namesInCreationOrder`, so ascending date order matches that order.
    await expect.poll(() => exhibitNameColumn(page), { timeout: 10000 }).toEqual(namesInCreationOrder);
  });

  test('Exhibit List Sorting - paginator reflects range and pages through rows', async ({
    galleryAuthenticatedPage: page,
  }) => {
    const { collectionName, namesInCreationOrder } = await seedPaginatedSortableExhibits();
    const ascendingByName = [...namesInCreationOrder].sort();

    await gotoGalleryAdmin(page);
    await gotoAdminSection(page, 'Exhibits');
    await selectCollection(page, collectionName);

    const paginatorRange = page.getByRole('status');
    const nextPage = page.getByRole('button', { name: 'Next page' });
    const previousPage = page.getByRole('button', { name: 'Previous page' });

    // With [pageSize]="10" and 12 seeded exhibits, only page 1's 10 rows render, and
    // the range label reflects that — not "0 of 0" (the dead-paginator symptom) and
    // not all 12 rows on a single page.
    await expect(page.locator('tr.element-row')).toHaveCount(10);
    await expect(paginatorRange).toHaveText(`1 – 10 of ${namesInCreationOrder.length}`);
    await expect(previousPage).toBeDisabled();
    await expect(nextPage).toBeEnabled();

    // Sort by Name ascending so which rows land on page 1 vs. page 2 is deterministic.
    const nameHeader = page.getByRole('columnheader', { name: 'Name' });
    await nameHeader.getByRole('button').click();
    await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    await expect.poll(() => exhibitNameColumn(page), { timeout: 10000 }).toEqual(ascendingByName.slice(0, 10));

    // Paging forward shows the remaining 2 rows and updates the range label.
    await nextPage.click();
    await expect(page.locator('tr.element-row')).toHaveCount(2);
    await expect(paginatorRange).toHaveText(`11 – ${namesInCreationOrder.length} of ${namesInCreationOrder.length}`);
    await expect.poll(() => exhibitNameColumn(page), { timeout: 10000 }).toEqual(ascendingByName.slice(10));
    await expect(nextPage).toBeDisabled();
    await expect(previousPage).toBeEnabled();

    // Paging back restores page 1.
    await previousPage.click();
    await expect(page.locator('tr.element-row')).toHaveCount(10);
    await expect(paginatorRange).toHaveText(`1 – 10 of ${namesInCreationOrder.length}`);
    await expect.poll(() => exhibitNameColumn(page), { timeout: 10000 }).toEqual(ascendingByName.slice(0, 10));
  });
});
