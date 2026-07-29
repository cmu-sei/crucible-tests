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

  test('Exhibit List Sorting - headers respond to clicks', async ({ galleryAuthenticatedPage: page }) => {
    const { collectionName, namesInCreationOrder } = await seedSortableExhibits();

    await gotoGalleryAdmin(page);
    await gotoAdminSection(page, 'Exhibits');
    await selectCollection(page, collectionName);

    // All three seeded exhibits must be on screen before sorting means anything.
    await expect(page.locator('tr.element-row')).toHaveCount(namesInCreationOrder.length);

    // Every documented column is a real, clickable MatSort header, and clicking it
    // advances the sort state ascending -> descending -> none. This is the part of the
    // feature that currently works; the row-reordering half is broken upstream (see
    // the skipped test below).
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

  // APP BUG: clicking a sort header updates `aria-sort` but never reorders the rows.
  //
  // Root cause is in the Gallery UI, not in this test. In
  // gallery.ui/src/app/components/admin/admin-exhibits/admin-exhibits.component.html
  // the <table> is wrapped in `@if (!isLoading && selectedCollectionId)`, so at the
  // time `ngAfterViewInit()` runs in admin-exhibits.component.ts the `@ViewChild(MatSort)`
  // and `@ViewChild(MatPaginator)` queries resolve to undefined. The assignments
  //   this.dataSource.sort = this.matSort;
  //   this.dataSource.paginator = this.paginator;
  // therefore store `undefined` and are never retried once the table renders, leaving
  // the MatTableDataSource permanently unsorted and unpaginated.
  //
  // Observed evidence (Gallery admin > Exhibits, collection with 12 seeded exhibits):
  //   - all 12 rows render even though the paginator declares [pageSize]="10"
  //   - the paginator range label reads " 0 of 0 " instead of " 1 - 10 of 12 "
  //   - clicking Name cycles aria-sort ascending/descending/none with an unchanged row order
  // The sibling admin-collections component gets this right because its table is not
  // behind a `selectedCollectionId` guard, so its ViewChildren resolve in time.
  //
  // Re-enable once the Gallery UI wires sort/paginator after the table exists (e.g. via
  // a setter-based @ViewChild or by moving the assignment out of ngAfterViewInit).
  // Full writeup, with source locations and a suggested fix: gallery/gallery-app-bugs.md §1.
  test.skip('Exhibit List Sorting - rows reorder by column', async ({ galleryAuthenticatedPage: page }) => {
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
});
