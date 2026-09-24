// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Drag-and-drop reordering of a MSEL's Data Fields list. The `mat-table` is a `cdkDropList`
// and each row's drag icon a `cdkDrag` whose root is the row; dropping a row saves it with the
// target row's `displayOrder` (`dropHandler` in data-field-list.component.ts) and the API
// shifts the others. That renumbering is Blueprint.Api.Tests' job (DataFieldReorderTests);
// this spec covers the gesture, the re-rendered order, and the order surviving a reload.
//
// The list always starts with four system-defined rows (Move, Group, Execution Time,
// Integration Target — `createSystemDefinedDataFields`, negative displayOrder) that are not
// stored fields, cannot be dragged and are not sorted. The standard seeded fields also include
// a "Move" and a "Group", so rows are told apart by the '*System Defined*' marker.

import { Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  seedMselDataFields,
  listMselDataFields,
  navigateToMselSection,
  cdkDragTo,
} from '../../test-helpers';

const SYSTEM_FIELDS = ['Move', 'Group', 'Execution Time', 'Integration Target'];

/** Rows for the MSEL's own data fields, excluding the system-defined rows. */
function userFieldRows(page: Page) {
  return page.locator('mat-row').filter({ hasNotText: '*System Defined*' });
}

/** The names of all rows, system-defined ones included, top to bottom. */
async function allRowNames(page: Page): Promise<string[]> {
  const names = await page.locator('mat-row mat-cell.column-name').allInnerTexts();
  return names.map((n) => n.trim());
}

/** The MSEL's own data field names, top to bottom. */
async function renderedFieldNames(page: Page): Promise<string[]> {
  const names = await userFieldRows(page).locator('mat-cell.column-name').allInnerTexts();
  return names.map((n) => n.trim());
}

/** The row for one of the MSEL's own fields, by exact name ("Title" must not match "Subtitle"). */
function fieldRow(page: Page, name: string) {
  return userFieldRows(page).filter({
    has: page.locator('mat-cell.column-name', { hasText: new RegExp(`^\\s*${name}\\s*$`) }),
  });
}

test.describe('Data Fields Drag and Drop Reordering', () => {
  let token: string;
  let mselId: string;
  let originalOrder: string[];

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    mselId = (await createMsel(token)).id;
    const fields = await seedMselDataFields(token, mselId);
    originalOrder = [...fields]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((f) => f.name as string);
  });

  test.afterEach(async () => {
    // The MSEL delete cascades to its data fields.
    if (mselId) await deleteMsel(token, mselId);
  });

  test('Dragging a data field to a new position reorders the list and persists', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    // 1. Open the MSEL's Data Fields section
    await navigateToMselSection(page, mselId, 'Data Fields');

    // expect: the system-defined rows come first, followed by the fields in display order
    await expect.poll(() => allRowNames(page)).toEqual([...SYSTEM_FIELDS, ...originalOrder]);

    // expect: only the MSEL's own fields can be dragged
    await expect(page.locator('mat-row .cdk-drag-handle')).toHaveCount(originalOrder.length);
    await expect(
      page.locator('mat-row').filter({ hasText: '*System Defined*' }).locator('.cdk-drag-handle')
    ).toHaveCount(0);

    // 2. Drag "Title" (8th) onto the seeded "Move" (2nd)
    const titleRow = fieldRow(page, 'Title');
    const handle = titleRow.locator('.cdk-drag-handle');
    await expect(handle).toBeVisible();

    const titleId = (await listMselDataFields(token, mselId)).find((f) => f.name === 'Title').id;
    const saved = page.waitForResponse(
      (res) =>
        res.request().method() === 'PUT' &&
        res.url().toLowerCase().includes(`/api/datafields/${titleId}`),
      { timeout: 15000 }
    );
    await cdkDragTo(page, handle, fieldRow(page, 'Move'));
    expect((await saved).ok(), 'the dropped field is saved').toBe(true);

    // expect: "Title" now sits second and everything it passed shifted down one
    const expected = [
      originalOrder[0],
      'Title',
      ...originalOrder.slice(1).filter((n) => n !== 'Title'),
    ];
    await expect.poll(() => renderedFieldNames(page)).toEqual(expected);

    // 3. Reload the page
    await navigateToMselSection(page, mselId, 'Data Fields');

    // expect: the new order is still shown, so it came from the server rather than local state
    await expect.poll(() => renderedFieldNames(page)).toEqual(expected);
  });

  test('Drag handles are removed while the list is sorted by a column', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    await navigateToMselSection(page, mselId, 'Data Fields');
    const handles = page.locator('mat-row .cdk-drag-handle');
    await expect(handles).toHaveCount(originalOrder.length);

    // 1. Sort by Name
    // A sorted list no longer reflects display order, so the list turns drag-and-drop off and
    // stops rendering the handles.
    const nameHeader = page.locator('mat-header-cell.column-name');
    await nameHeader.click();

    // expect: the fields are alphabetical, still after the (unsorted) system-defined rows, and
    // nothing can be dragged
    await expect.poll(() => allRowNames(page)).toEqual([
      ...SYSTEM_FIELDS,
      ...[...originalOrder].sort((a, b) => a.localeCompare(b)),
    ]);
    await expect(handles).toHaveCount(0);

    // 2. Clear the sort (ascending -> descending -> none)
    await nameHeader.click();
    await nameHeader.click();

    // expect: display order and the handles are back
    await expect.poll(() => allRowNames(page)).toEqual([...SYSTEM_FIELDS, ...originalOrder]);
    await expect(handles).toHaveCount(originalOrder.length);
  });
});
