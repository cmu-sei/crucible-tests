// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Drag-and-drop reordering of the Scenario Events grid. The grid's `<tbody>` is a
// `cdkDropList` and each event row a `cdkDrag`; dropping a row makes the UI compute a new
// `deltaSeconds`/`groupOrder` for it (`dropHandler` in scenario-event-list.component.ts) and
// PUT the event. The API's handling of that PUT is Blueprint.Api.Tests' job; what only a
// browser can show is that the drag gesture works, that the grid re-renders in the new order,
// and that the order survives a reload.

import { Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createRenderableScenarioEvent,
  getScenarioEvent,
  navigateToMselSection,
  findScenarioEventRow,
  tempBlueprintName,
  cdkDragTo,
} from '../../test-helpers';

/**
 * The order in which the given (unique) texts appear in the Scenario Events grid.
 *
 * Relative order only: the grid can also hold rows this spec did not seed (the API broadcasts
 * other MSELs' scenario events to admins and the UI upserts them into the same store — see
 * `findScenarioEventRow`), so absolute row positions are not stable.
 */
async function renderedOrder(page: Page, texts: string[]): Promise<string[]> {
  const rowTexts = await page.locator('table tbody tr').allInnerTexts();
  return rowTexts
    .map((rowText) => texts.find((t) => rowText.includes(t)))
    .filter((t): t is string => !!t);
}

test.describe('Scenario Events Drag and Drop Reordering', () => {
  let token: string;
  let mselId: string;
  const ids: Record<'first' | 'second' | 'third', string> = { first: '', second: '', third: '' };
  const text = {
    first: tempBlueprintName('TestBP-DragFirst'),
    second: tempBlueprintName('TestBP-DragSecond'),
    third: tempBlueprintName('TestBP-DragThird'),
  };

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    mselId = (await createMsel(token)).id;
    // Hours apart, and well clear of the 0-offset events other specs seed, so the midpoint the
    // UI computes for a dropped row is unambiguous.
    ids.first = (await createRenderableScenarioEvent(token, mselId, text.first, { deltaSeconds: 7200 })).id;
    ids.second = (await createRenderableScenarioEvent(token, mselId, text.second, { deltaSeconds: 10800 })).id;
    ids.third = (await createRenderableScenarioEvent(token, mselId, text.third, { deltaSeconds: 14400 })).id;
  });

  test.afterEach(async () => {
    // The MSEL delete cascades to its scenario events.
    if (mselId) await deleteMsel(token, mselId);
  });

  test('Dragging an event to a new position reorders the grid and persists', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const all = [text.first, text.second, text.third];

    // 1. Open the MSEL's Scenario Events section
    await navigateToMselSection(page, mselId, 'Scenario Events');
    const thirdRow = await findScenarioEventRow(page, text.third);
    const secondRow = await findScenarioEventRow(page, text.second);

    // expect: the events are listed chronologically
    await expect.poll(() => renderedOrder(page, all)).toEqual([text.first, text.second, text.third]);

    // expect: an admin sees a drag handle on each row
    const handle = thirdRow.locator('.cdk-drag-handle');
    await expect(handle).toBeVisible();

    // 2. Drag the third event onto the second event's slot
    const saved = page.waitForResponse(
      (res) =>
        res.request().method() === 'PUT' &&
        res.url().toLowerCase().includes(`/api/scenarioevents/${ids.third}`),
      { timeout: 15000 }
    );
    await cdkDragTo(page, handle, secondRow);
    expect((await saved).ok(), 'the dropped event is saved').toBe(true);

    // expect: the grid re-renders with the dragged event between the other two
    await expect.poll(() => renderedOrder(page, all)).toEqual([text.first, text.third, text.second]);

    // 3. Reload the page
    await navigateToMselSection(page, mselId, 'Scenario Events');
    await findScenarioEventRow(page, text.third);

    // expect: the new order is still shown, so it came from the server rather than local state
    await expect.poll(() => renderedOrder(page, all)).toEqual([text.first, text.third, text.second]);

    // Secondary: the UI placed the event midway between its new neighbours.
    const moved = await getScenarioEvent(token, ids.third);
    expect(Number(moved.deltaSeconds)).toBe(9000);
  });

  test('Drag handles are hidden while the grid is sorted by a column', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    await navigateToMselSection(page, mselId, 'Scenario Events');
    const row = await findScenarioEventRow(page, text.first);
    const handle = row.locator('.cdk-drag-handle');
    await expect(handle).toBeVisible();

    // 1. Sort the grid by the Description column
    // A sorted view no longer reflects the event timeline, so a drop position would be
    // meaningless; the grid switches drag-and-drop off (`sortChanged` clears
    // `allowDragAndDrop`) and hides the handles.
    const descriptionHeader = page
      .locator('thead th.mat-sort-header')
      .filter({ hasText: /^\s*Description\s*$/ });
    await descriptionHeader.click();

    // expect: the handles are hidden
    await expect(handle).toBeHidden();

    // 2. Clear the sort (ascending -> descending -> none)
    await descriptionHeader.click();
    await descriptionHeader.click();

    // expect: the handles come back
    await expect(handle).toBeVisible();
  });
});
