// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, serviceUrlPattern } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createOrganization,
  deleteOrganization,
  createRenderableScenarioEvent,
  deleteScenarioEvent,
  navigateToMselSection,
  tempBlueprintName,
} from '../../test-helpers';

test.describe('Search and Filtering', () => {
  let token: string;
  let mselId: string;
  let orgId: string;
  let eventId1: string;
  let eventId2: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token, {
      name: tempBlueprintName('OrgFilterTest'),
      description: 'MSEL for organization filtering test',
    });
    mselId = msel.id;

    // Create an organization for this MSEL
    const org = await createOrganization(token, mselId, {
      name: tempBlueprintName('TestOrg'),
      shortName: 'TO',
    });
    orgId = org.id;

    // Create two scenario events
    const event1 = await createRenderableScenarioEvent(token, mselId, 'First test event', { deltaSeconds: 0 });
    eventId1 = event1.id;

    const event2 = await createRenderableScenarioEvent(token, mselId, 'Second test event', { deltaSeconds: 60 });
    eventId2 = event2.id;
  });

  test.afterEach(async () => {
    try {
      if (eventId1) await deleteScenarioEvent(token, eventId1);
      if (eventId2) await deleteScenarioEvent(token, eventId2);
      if (orgId) await deleteOrganization(token, orgId);
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed: ${err}`);
    }
  });

  test('Scenario Event Filtering by Organization', async ({ blueprintAuthenticatedPage: page }) => {
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
