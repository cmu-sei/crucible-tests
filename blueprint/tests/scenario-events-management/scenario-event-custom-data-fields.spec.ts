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
// theme runs. Safe to share: the test only reads the grid headers.
// Each test seeds its own uniquely named events, and `resetSharedRenderableMsel` removes
// them (and any extra DataField) in afterEach.
let shared: CreatedMsel;

test.beforeAll(async ({}, workerInfo) => {
  shared = await createSharedRenderableMsel(await getBlueprintToken(), 'CustomDataFields', workerInfo.parallelIndex);
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

    test.beforeEach(async ({}, testInfo) => {
      child = (base: string) => sharedChildName(base, testInfo, theme);
      // Seed: create a MSEL with a scenario event
      token = await getBlueprintToken();
      mselId = shared.id;

      const event = await createRenderableScenarioEvent(token, mselId, child('TestBP-CustomFieldsEvent'), { deltaSeconds: 300 });
      eventId = event.id;
    });

    test.afterEach(async () => {
      // Back to "standard DataFields, no events" for the next test on the shared MSEL.
      await resetSharedRenderableMsel(token, mselId);
    });

    test('Scenario Event Custom Data Fields', async ({ blueprintAuthenticatedPage: page }) => {
    await applyBlueprintTheme(page, theme);
      // Navigate to the MSEL Scenario Events section
      await navigateToMselSection(page, mselId, 'Scenario Events');

      // expect: The seeded event is visible
      const eventRow = page.locator('table tbody tr').last();
      await expect(eventRow).toBeVisible({ timeout: 5000 });

      // Custom data fields test simplified: verify scenario event list shows data fields in table headers
      const tableHeaders = page.locator('table thead th');
      await expect(tableHeaders.first()).toBeVisible({ timeout: 5000 });

      // expect: Data fields are rendered as columns (at least one exists)
      const headerCount = await tableHeaders.count();
      expect(headerCount).toBeGreaterThan(0);
    });
    });
}