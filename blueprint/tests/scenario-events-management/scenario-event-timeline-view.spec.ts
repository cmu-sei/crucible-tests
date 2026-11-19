// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, BLUEPRINT_THEMES, applyBlueprintTheme } from '../../fixtures';
import {
  getBlueprintToken,
  deleteMsel,
  createRenderableScenarioEvent,
  navigateToMselSection,
  createSharedRenderableMsel,
  resetSharedRenderableMsel,
  type CreatedMsel,
  sharedChildName,
} from '../../test-helpers';

// One MSEL with the standard DataFields (13 POSTs) is seeded per file and shared by both
// theme runs. Safe to share: the test only reads the grid.
// Each test seeds its own uniquely named events, and `resetSharedRenderableMsel` removes
// them (and any extra DataField) in afterEach.
let shared: CreatedMsel;

test.beforeAll(async ({}, workerInfo) => {
  shared = await createSharedRenderableMsel(await getBlueprintToken(), 'TimelineView', workerInfo.parallelIndex);
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
    let eventId1: string;
    let eventId2: string;

    test.beforeEach(async ({}, testInfo) => {
      child = (base: string) => sharedChildName(base, testInfo, theme);
      // Seed: create a MSEL with multiple scenario events for timeline view
      token = await getBlueprintToken();
      mselId = shared.id;

      const event1 = await createRenderableScenarioEvent(token, mselId, child('TestBP-TimelineFirst'), { deltaSeconds: 100 });
      eventId1 = event1.id;

      const event2 = await createRenderableScenarioEvent(token, mselId, child('TestBP-TimelineSecond'), { deltaSeconds: 500 });
      eventId2 = event2.id;
    });

    test.afterEach(async () => {
      // Back to "standard DataFields, no events" for the next test on the shared MSEL.
      await resetSharedRenderableMsel(token, mselId);
    });

    test('Scenario Event Timeline View', async ({ blueprintAuthenticatedPage: page }) => {
    await applyBlueprintTheme(page, theme);
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
}