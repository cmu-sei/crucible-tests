// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, BLUEPRINT_THEMES, applyBlueprintTheme } from '../../fixtures';
import {
  getBlueprintToken,
  deleteMsel,
  createRenderableScenarioEvent,
  listScenarioEvents,
  navigateToMselSection,
  findScenarioEventRow,
  createSharedRenderableMsel,
  resetSharedRenderableMsel,
  type CreatedMsel,
  sharedChildName,
} from '../../test-helpers';

/**
 * Deleting a scenario event from the row's Action List menu, including the cancel path.
 *
 * The row is located by its seeded Description, not by position. `table tbody tr').last()`
 * used to pick a different row, and the DELETE then never came for `eventId` so the paired
 * `waitForResponse` timed out. See `findScenarioEventRow` for why position is unsafe here,
 * including the pending upstream cross-MSEL leak that makes it worse.
 */
// One MSEL with the standard DataFields (13 POSTs) is seeded per file and shared by both
// theme runs. Safe to share: the delete removes only the test's own event.
// Each test seeds its own uniquely named events, and `resetSharedRenderableMsel` removes
// them (and any extra DataField) in afterEach.
let shared: CreatedMsel;

test.beforeAll(async ({}, workerInfo) => {
  shared = await createSharedRenderableMsel(await getBlueprintToken(), 'DeleteEvent', workerInfo.parallelIndex);
});

test.afterAll(async () => {
  if (shared) await deleteMsel(await getBlueprintToken(), shared.id);
});

for (const theme of BLUEPRINT_THEMES) {
    test.describe(`${theme} theme › Scenario Events Management`, () => {
    // Per-test names for this test's own records on the shared MSEL.
    let child: (base: string) => string;
    let token: string;
    let mselId: string;
    let eventId: string;
    let description: string;

    test.beforeEach(async ({}, testInfo) => {
      child = (base: string) => sharedChildName(base, testInfo, theme);
      // Seed: create a MSEL with a renderable scenario event to delete
      token = await getBlueprintToken();
      mselId = shared.id;

      // Unique per run, so the row locator below can never resolve to another spec's event.
      description = child('TestBP-DeleteEvent');
      const event = await createRenderableScenarioEvent(
        token,
        mselId,
        description,
        {
          deltaSeconds: 300,
          rowMetadata: 'DELETE-001',
        }
      );
      eventId = event.id;
    });

    test.afterEach(async () => {
      // Back to "standard DataFields, no events" for the next test on the shared MSEL.
      await resetSharedRenderableMsel(token, mselId);
    });

    test('Delete Scenario Event', async ({ blueprintAuthenticatedPage: page }) => {
    await applyBlueprintTheme(page, theme);
      // Navigate to the MSEL Scenario Events section
      await navigateToMselSection(page, mselId, 'Scenario Events');

      // expect: The seeded event is visible (row exists), identified by its unique Description
      const eventRow = await findScenarioEventRow(page, description);
      await expect(eventRow).toBeVisible({ timeout: 5000 });

      // 2. Click the Action List button for the first event to open the menu
      const actionListButton = eventRow.getByRole('button', { name: /Action List/i });
      await expect(actionListButton).toBeVisible({ timeout: 5000 });
      await actionListButton.click();

      // Click the Delete option from the menu
      const deleteMenuItem = page.getByRole('menuitem', { name: /delete/i });
      await expect(deleteMenuItem).toBeVisible({ timeout: 5000 });
      await deleteMenuItem.click();

      // expect: A confirmation dialog appears
      const confirmDialog = page.locator('crucible-dialog, [role="dialog"]').filter({ hasText: /delete/i });
      await expect(confirmDialog).toBeVisible({ timeout: 5000 });

      // 3. Click 'Cancel' or 'No' button
      const cancelButton = confirmDialog.getByRole('button', { name: /no|cancel/i });
      await cancelButton.click();

      // expect: Dialog closes
      await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });

      // expect: Event is not deleted (still visible)
      await expect(eventRow).toBeVisible();

      // 4. Click the Action List button again to open the menu
      await actionListButton.click();

      // Click the Delete option from the menu again
      const deleteMenuItem2 = page.getByRole('menuitem', { name: /delete/i });
      await expect(deleteMenuItem2).toBeVisible({ timeout: 5000 });
      await deleteMenuItem2.click();

      // Wait for dialog to appear again
      const confirmDialog2 = page.locator('crucible-dialog, [role="dialog"]').filter({ hasText: /delete/i });
      await expect(confirmDialog2).toBeVisible({ timeout: 5000 });

      // Click confirm/delete button and wait for the DELETE request
      const confirmButton = confirmDialog2.getByRole('button', { name: /yes|delete|confirm|ok/i });
      const deletePromise = page.waitForResponse(
        (res) => new RegExp(`/api/scenarioevents/${eventId}`, 'i').test(res.url()) && res.request().method() === 'DELETE',
        { timeout: 10000 }
      );
      await confirmButton.click();

      // expect: The event is deleted successfully (server-side).
      // Note: DELETE /api/scenarioEvents/{id} answers **200**, not the 204 that
      // /api/msels/{id} and /api/teams/{id} return. Verified directly against the API.
      const deleteResponse = await deletePromise;
      expect(deleteResponse.status()).toBe(200);

      // expect: Event is removed from the list (or list becomes empty)
      await expect(eventRow).not.toBeVisible({ timeout: 10000 });

      // ...and it is really gone server-side, not just de-rendered.
      const remaining = await listScenarioEvents(token, mselId);
      expect(remaining.map((e: any) => e.id)).not.toContain(eventId);
    });
    });
}