// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createRenderableScenarioEvent,
  navigateToMselSection,
  getScenarioEvent,
  findScenarioEventRow,
  tempBlueprintName,
} from '../../test-helpers';

/**
 * Editing a scenario event through the row's Action List → Edit dialog.
 *
 * Three things about this surface are easy to get wrong, and the previous version of this
 * spec got all three:
 *
 * 1. **The row action button must be scoped to a row.** The table header carries its own
 *    `Action List` button whose menu is `["Add New Event", "Add Inject from Catalog"]` —
 *    no Edit item. `getByRole('button', { name: /Action List/i }).first()` picks *that*
 *    one, so the Edit menu item never appears. Each event row has a
 *    `title="Event N Action List"` button; the row menu is
 *    `["View", "Edit", "Highlight", "Copy", "Delete"]`.
 * 2. **The save request path is lowercase**: `PUT /api/scenarioevents/{id}`. A
 *    `url().includes('/api/scenarioEvents')` predicate never matches and the wait times out.
 * 3. **The edit dialog has no "Row Metadata" field.** Its inputs are the MSEL's data
 *    fields (Control Number, Expected Actions, Move, Details, Delivery Time, Simulated
 *    Time, Group, From Org, Status, ...) plus the execution date/time. The old spec looked
 *    for a nonexistent field inside `if (await ...isVisible())`, so the edit silently
 *    never happened and the test asserted a save of nothing.
 *
 * Scenario events also need the MSEL to have data fields before the grid renders any rows
 * at all — `createRenderableScenarioEvent` handles that.
 *
 * The row is located by its seeded Description, not by position. `table tbody tr').last()`
 * used to pick the wrong row and the PUT then came back **404 ScenarioEvent not found** for
 * an id from another worker's MSEL. See `findScenarioEventRow` for why position is unsafe
 * here, including the pending upstream cross-MSEL leak that makes it worse.
 */
test.describe('Scenario Events Management', () => {
  let token: string;
  let mselId: string;
  let eventId: string;
  let description: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token);
    mselId = msel.id;

    // Unique per run, so the row locator below can never resolve to another spec's event.
    description = tempBlueprintName('TestBP-EditEvent');
    const event = await createRenderableScenarioEvent(token, mselId, description, {
      deltaSeconds: 600,
      rowMetadata: 'EDIT-001',
    });
    eventId = event.id;
  });

  test.afterEach(async () => {
    // Deleting the MSEL cascades to its events and data fields.
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Edit Scenario Event', async ({ blueprintAuthenticatedPage: page }) => {
    await navigateToMselSection(page, mselId, 'Scenario Events');

    // The seeded event's row, identified by its unique Description data value. Rows render
    // only once the MSEL has data fields (createRenderableScenarioEvent seeds them).
    const eventRow = await findScenarioEventRow(page, description);
    await expect(eventRow).toBeVisible({ timeout: 15000 });

    // Open the ROW's action menu, not the header's.
    await eventRow.getByRole('button', { name: /Action List/i }).click();
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();

    const dialog = page.getByRole('dialog').filter({ hasText: 'Edit Event' });
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Edit a field that genuinely exists on this dialog, and prove it took.
    const controlNumber = dialog.locator('input[placeholder="Control Number"]');
    await expect(controlNumber).toBeVisible({ timeout: 10000 });
    const newControlNumber = `EDITED-${eventId.slice(0, 8)}`;
    await controlNumber.fill(newControlNumber);
    await expect(controlNumber).toHaveValue(newControlNumber);

    // Save, paired with the PUT it triggers (lowercase path).
    const savePromise = page.waitForResponse(
      (res) =>
        /\/api\/scenarioevents\//i.test(res.url()) && res.request().method() === 'PUT',
      { timeout: 15000 }
    );
    await dialog.getByRole('button', { name: /^Save$/ }).click();
    expect((await savePromise).status()).toBe(200);

    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // The edit is persisted server-side, in the Control Number data value.
    const persisted = await getScenarioEvent(token, eventId);
    const values = (persisted.dataValues ?? []).map((dv: any) => dv.value);
    expect(values).toContain(newControlNumber);

    // The row is still listed — the same row, matched by its Description.
    await expect(eventRow).toBeVisible();
  });
});
