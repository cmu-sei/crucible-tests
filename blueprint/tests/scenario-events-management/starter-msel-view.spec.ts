// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, BLUEPRINT_THEMES, applyBlueprintTheme } from '../../fixtures';
import {
  getBlueprintToken,
  deleteMsel,
  createRenderableScenarioEvent,
  createSharedRenderableMsel,
  resetSharedRenderableMsel,
  type CreatedMsel,
  sharedChildName,
} from '../../test-helpers';

// One MSEL with the standard DataFields (13 POSTs) is seeded per file and shared by both
// theme runs. Safe to share: the test only reads the starter view.
// Each test seeds its own uniquely named events, and `resetSharedRenderableMsel` removes
// them (and any extra DataField) in afterEach.
let shared: CreatedMsel;

test.beforeAll(async ({}, workerInfo) => {
  shared = await createSharedRenderableMsel(await getBlueprintToken(), 'StarterView', workerInfo.parallelIndex);
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
      // Seed: create a MSEL with a scenario event for the starter view
      token = await getBlueprintToken();
      mselId = shared.id;

      const event = await createRenderableScenarioEvent(token, mselId, child('TestBP-StarterEvent'), { deltaSeconds: 300 });
      eventId = event.id;
    });

    test.afterEach(async () => {
      // Back to "standard DataFields, no events" for the next test on the shared MSEL.
      await resetSharedRenderableMsel(token, mselId);
    });

    test('Starter MSEL View', async ({ blueprintAuthenticatedPage: page }) => {
    await applyBlueprintTheme(page, theme);
      // 1. Navigate to /starter?msel={mselId}
      await page.goto(`${Services.Blueprint.UI}/starter?msel=${mselId}`, {
        waitUntil: 'domcontentloaded',
      });

      // expect: Starter page loads with Blueprint topbar
      await expect(page).toHaveURL(/.*\/starter.*/, { timeout: 10000 });

      const topbar = page.locator('mat-toolbar').first();
      await expect(topbar).toBeVisible({ timeout: 5000 });

      // expect: Scenario event list is displayed in starter mode for direct editing
      const scenarioEventTable = page.locator('table').first();
      await expect(scenarioEventTable).toBeVisible({ timeout: 5000 });

      // Verify the seeded event is present
      await expect(page.locator('table tbody tr').last()).toBeVisible();
    });
    });
}