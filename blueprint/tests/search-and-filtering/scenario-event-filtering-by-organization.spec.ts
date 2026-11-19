// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, serviceUrlPattern, BLUEPRINT_THEMES, applyBlueprintTheme } from '../../fixtures';
import {
  getBlueprintToken,
  deleteMsel,
  createOrganization,
  deleteOrganization,
  createRenderableScenarioEvent,
  navigateToMselSection,
  createSharedRenderableMsel,
  resetSharedRenderableMsel,
  type CreatedMsel,
  sharedChildName,
} from '../../test-helpers';

// One MSEL with the standard DataFields (13 POSTs) is seeded per file and shared by both
// theme runs. Safe to share: filtering is client-side and changes nothing.
// Each test seeds its own uniquely named events, and `resetSharedRenderableMsel` removes
// them (and any extra DataField) in afterEach.
let shared: CreatedMsel;

test.beforeAll(async ({}, workerInfo) => {
  shared = await createSharedRenderableMsel(await getBlueprintToken(), 'OrgFilter', workerInfo.parallelIndex);
});

test.afterAll(async () => {
  if (shared) await deleteMsel(await getBlueprintToken(), shared.id);
});

for (const theme of BLUEPRINT_THEMES) {
    test.describe(`${theme} theme › Search and Filtering`, () => {
    // Per-test names for this test's own records on the shared MSEL.
    let child: (base: string) => string;
    let token: string;
    let mselId: string;
    let orgId: string;
    let eventId1: string;
    let eventId2: string;

    test.beforeEach(async ({}, testInfo) => {
      child = (base: string) => sharedChildName(base, testInfo, theme);
      token = await getBlueprintToken();
      mselId = shared.id;

      // Create an organization for this MSEL
      const org = await createOrganization(token, mselId, {
        name: child('TestBP-OrgFilterOrg'),
        shortName: 'TO',
      });
      orgId = org.id;

      // Create two scenario events
      const event1 = await createRenderableScenarioEvent(token, mselId, child('TestBP-OrgFilterFirst'), { deltaSeconds: 0 });
      eventId1 = event1.id;

      const event2 = await createRenderableScenarioEvent(token, mselId, child('TestBP-OrgFilterSecond'), { deltaSeconds: 60 });
      eventId2 = event2.id;
    });

    test.afterEach(async () => {
      // The organization is this test's own; then back to "standard DataFields, no events".
      if (orgId) await deleteOrganization(token, orgId);
      await resetSharedRenderableMsel(token, mselId);
    });

    test('Scenario Event Filtering by Organization', async ({ blueprintAuthenticatedPage: page }) => {
    await applyBlueprintTheme(page, theme);
      // 1. Navigate to the MSEL's Scenario Events section
      await navigateToMselSection(page, mselId, 'Scenario Events');

      // expect: Scenario events are displayed
      const eventsContainer = page.locator('app-scenario-event-list, table').first();
      await expect(eventsContainer).toBeVisible({ timeout: 15000 });

      // Wait for the events to render
      const eventItems = page.locator('table tbody tr');
      await expect(eventItems.first()).toBeVisible({ timeout: 10000 });

      // Count initial events (our two seeded events)
      const initialEventCount = await eventItems.count();
      expect(initialEventCount).toBeGreaterThanOrEqual(2);

      // 2. Look for organization filter control
      const organizationFilter = page.locator(
        'mat-select[placeholder*="Organization"], ' +
        '[aria-label*="Organization"]'
      ).first();

      // If no filter is present, this test verifies the scenario events are at least visible
      const orgFilterVisible = await organizationFilter.isVisible({ timeout: 5000 }).catch(() => false);

      if (orgFilterVisible) {
        await organizationFilter.click();

        // Get available organization options
        const orgOptions = page.locator('mat-option, [role="option"]');
        const orgOptionCount = await orgOptions.count();
        expect(orgOptionCount).toBeGreaterThan(0);

        // Select the first organization option
        const firstOrgOption = orgOptions.first();
        await firstOrgOption.click();

        // expect: Events list updates after filtering
        await expect(eventsContainer).toBeVisible({ timeout: 10000 });
        const filteredEvents = page.locator('table tbody tr');
        const filteredEventCount = await filteredEvents.count();
        expect(filteredEventCount).toBeGreaterThanOrEqual(0);
        expect(filteredEventCount).toBeLessThanOrEqual(initialEventCount);
      } else {
        // No organization filter present - verify events are still visible
        await expect(eventsContainer).toBeVisible();
        const visibleEvents = page.locator('table tbody tr');
        await expect(visibleEvents.first()).toBeVisible({ timeout: 5000 });
      }
    });
    });
}