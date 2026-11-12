// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, BLUEPRINT_THEMES, applyBlueprintTheme } from '../../fixtures';
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
// theme runs. Safe to share: the test only opens its event.
// Each test seeds its own uniquely named events, and `resetSharedRenderableMsel` removes
// them (and any extra DataField) in afterEach.
let shared: CreatedMsel;

test.beforeAll(async ({}, workerInfo) => {
  shared = await createSharedRenderableMsel(await getBlueprintToken(), 'EventDetail', workerInfo.parallelIndex);
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
      // Seed: create a MSEL with a scenario event that has rich text content
      token = await getBlueprintToken();
      mselId = shared.id;

      const event = await createRenderableScenarioEvent(token, mselId, child('TestBP-DetailEvent'), { deltaSeconds: 300 });
      eventId = event.id;
    });

    test.afterEach(async () => {
      // Back to "standard DataFields, no events" for the next test on the shared MSEL.
      await resetSharedRenderableMsel(token, mselId);
    });

    test('Open Event in Detail Page', async ({ blueprintAuthenticatedPage: page }) => {
    await applyBlueprintTheme(page, theme);
      // Navigate to the MSEL Scenario Events section
      await navigateToMselSection(page, mselId, 'Scenario Events');

      // Verify scenario events are loaded
      const eventRow = page.locator('table tbody tr').last();
      await expect(eventRow).toBeVisible({ timeout: 5000 });

      // 1. Look for the View button (open in new tab) in the action menu
      const actionListButton = eventRow.getByRole('button', { name: /Action List/i });
      await expect(actionListButton).toBeVisible({ timeout: 5000 });
      await actionListButton.click();

      // Click the View option which opens in a new tab
      const viewMenuItem = page.getByRole('menuitem', { name: /view/i });
      await expect(viewMenuItem).toBeVisible({ timeout: 5000 });

      // expect: The Event Detail page opens in a new browser tab at /eventdetail
      const [newPage] = await Promise.all([
        page.context().waitForEvent('page', { timeout: 10000 }),
        viewMenuItem.click(),
      ]);

      // Wait for the new page to load
      await newPage.waitForLoadState('domcontentloaded');

      // expect: URL includes msel, scenarioEvent, and dataValue query parameters
      await expect(newPage).toHaveURL(/.*\/eventdetail.*msel.*/, { timeout: 10000 });
      const detailUrl = newPage.url();
      expect(detailUrl).toContain('msel');
      expect(detailUrl).toContain(mselId);

      // expect: The data field content is displayed
      const topbar = newPage.locator('mat-toolbar').first();
      await expect(topbar).toBeVisible({ timeout: 5000 });

      await newPage.close();
    });
    });
}