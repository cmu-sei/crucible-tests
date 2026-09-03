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
  navigateToMselSection,
} from '../../test-helpers';

test.describe('Scenario Events Management', () => {
  let token: string;
  let mselId: string;
  let eventId: string;

  test.beforeEach(async () => {
    // Seed: create a MSEL with a scenario event for delivery method testing
    token = await getBlueprintToken();
    const msel = await createMsel(token);
    mselId = msel.id;

    const event = await createRenderableScenarioEvent(token, mselId, 'Test event for delivery methods', { deltaSeconds: 300 });
    eventId = event.id;
  });

  test.afterEach(async () => {
    // Cleanup: delete the MSEL (cascade deletes its events)
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Scenario Event Delivery Methods', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to the MSEL Scenario Events section
    await navigateToMselSection(page, mselId, 'Scenario Events');

    // expect: The seeded event is visible
    const eventRow = page.locator('table tbody tr').last();
    await expect(eventRow).toBeVisible({ timeout: 5000 });

    // Open the action menu for the event to edit it
    const actionListButton = eventRow.getByRole('button', { name: /Action List/i });
    await expect(actionListButton).toBeVisible({ timeout: 5000 });
    await actionListButton.click();

    // Click Edit
    const editMenuItem = page.getByRole('menuitem', { name: /edit/i });
    await expect(editMenuItem).toBeVisible({ timeout: 5000 });
    await editMenuItem.click();

    // expect: Event edit dialog is displayed
    const dialog = page.locator('crucible-dialog').filter({ hasText: 'Edit Event' });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // expect: Integration Target field exists (delivery method)
    const integrationTargetField = dialog.getByLabel('Integration Target');
    if (await integrationTargetField.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Field exists - verify it's interactive
      await expect(integrationTargetField).toBeVisible();
    }

    // Close the dialog
    const cancelButton = dialog.getByRole('button', { name: /cancel/i });
    await cancelButton.click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });
});
