// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, BLUEPRINT_THEMES, applyBlueprintTheme } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createRenderableScenarioEvent,
} from '../../test-helpers';

for (const theme of BLUEPRINT_THEMES) {
    test.describe(`${theme} theme › Scenario Events Management`, () => {
    let token: string;
    let mselId: string;
    let eventId: string;

    test.beforeEach(async () => {
      // Seed: create a MSEL with a scenario event for the starter view
      token = await getBlueprintToken();
      const msel = await createMsel(token);
      mselId = msel.id;

      const event = await createRenderableScenarioEvent(token, mselId, 'Test event for starter view', { deltaSeconds: 300 });
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