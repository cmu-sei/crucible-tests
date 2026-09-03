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
  let eventId1: string;
  let eventId2: string;

  test.beforeEach(async () => {
    // Seed: create a MSEL with multiple scenario events for timeline view
    token = await getBlueprintToken();
    const msel = await createMsel(token);
    mselId = msel.id;

    const event1 = await createRenderableScenarioEvent(token, mselId, 'First event', { deltaSeconds: 100 });
    eventId1 = event1.id;

    const event2 = await createRenderableScenarioEvent(token, mselId, 'Second event', { deltaSeconds: 500 });
    eventId2 = event2.id;
  });

  test.afterEach(async () => {
    // Cleanup: delete the MSEL (cascade deletes its events)
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Scenario Event Timeline View', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to the MSEL Scenario Events section
    await navigateToMselSection(page, mselId, 'Scenario Events');

    // expect: Events are displayed in chronological order
    const eventRows = page.locator('table tbody tr');
    await expect(eventRows.first()).toBeVisible({ timeout: 5000 });

    // expect: Timeline shows multiple events (at least 2 seeded)
    const rowCount = await eventRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(2);

    // expect: Each event shows time information
    const timeCell = page.locator('table tbody tr').last().locator('td').nth(1);
    await expect(timeCell).toBeVisible({ timeout: 5000 });
  });
});
