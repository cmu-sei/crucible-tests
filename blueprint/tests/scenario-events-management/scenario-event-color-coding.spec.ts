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
    // Seed: create a MSEL with a scenario event for color coding
    token = await getBlueprintToken();
    const msel = await createMsel(token);
    mselId = msel.id;

    const event = await createRenderableScenarioEvent(token, mselId, 'Test event for color coding', { deltaSeconds: 300 });
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

  test('Scenario Event Color Coding', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to the MSEL Scenario Events section
    await navigateToMselSection(page, mselId, 'Scenario Events');

    // expect: The seeded event is visible
    const eventRow = page.locator('table tbody tr').last();
    await expect(eventRow).toBeVisible({ timeout: 5000 });

    // Open the action menu for the event
    const actionListButton = eventRow.getByRole('button', { name: /Action List/i });
    await expect(actionListButton).toBeVisible({ timeout: 5000 });
    await actionListButton.click();

    // Click the Highlight menu item
    const highlightMenuItem = page.getByRole('menuitem', { name: /highlight/i });
    await expect(highlightMenuItem).toBeVisible({ timeout: 5000 });
    await highlightMenuItem.click();

    // expect: Color options menu appears
    const colorOption = page.locator('button.color-option-button').first();
    await expect(colorOption).toBeVisible({ timeout: 5000 });

    // Click a color option and wait for the PUT request
    const updatePromise = page.waitForResponse(
      (res) => /\/api\/scenarioevents/i.test(res.url()) && res.request().method() === 'PUT',
      { timeout: 10000 }
    );
    await colorOption.click();

    // expect: The event color is updated (server-side)
    const updateResponse = await updatePromise;
    expect(updateResponse.status()).toBe(200);

    // expect: The event row may have a background color applied (visual verification)
  });
});
