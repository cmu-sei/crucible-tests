// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createRenderableScenarioEvent,
  listScenarioEvents,
  navigateToMselSection,
} from '../../test-helpers';

test.describe('Scenario Events Management', () => {
  let token: string;
  let mselId: string;
  let eventId: string;

  test.beforeEach(async () => {
    // Seed: create a MSEL with a renderable scenario event to delete
    token = await getBlueprintToken();
    const msel = await createMsel(token);
    mselId = msel.id;

    const event = await createRenderableScenarioEvent(
      token,
      mselId,
      'Test event to delete',
      {
        deltaSeconds: 300,
        rowMetadata: 'DELETE-001',
      }
    );
    eventId = event.id;
  });

  test.afterEach(async () => {
    // Cleanup: delete the MSEL (cascade deletes any remaining events)
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Delete Scenario Event', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to the MSEL Scenario Events section
    await navigateToMselSection(page, mselId, 'Scenario Events');

    // expect: The seeded event is visible (row exists)
    const eventRow = page.locator('table tbody tr').last();
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
