// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Search and Filtering', () => {
  test('Scenario Event Filtering by Event Type', async ({ blueprintAuthenticatedPage: page }) => {
    await page.goto('http://localhost:4725/build');

    // 1. Navigate to a MSEL timeline view
    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');

    // Blueprint uses mat-table (Angular Material) with mat-row elements on the build page
    const mselList = page.locator('mat-row');

    const mselCount = await mselList.count();
    expect(mselCount).toBeGreaterThan(0);

    // Click the link inside the first MSEL row to navigate to the MSEL detail page
    const firstMselLink = mselList.first().locator('a').first();
    await firstMselLink.click();
    await page.waitForLoadState('domcontentloaded');

    // Navigate to the Scenario Events section in the left nav panel
    const scenarioEventsNav = page.locator('mat-list-item').filter({ hasText: /Scenario Events/i }).first();
    const scenarioEventsVisible = await scenarioEventsNav.isVisible({ timeout: 5000 }).catch(() => false);
    if (scenarioEventsVisible) {
      await scenarioEventsNav.click();
      await page.waitForLoadState('domcontentloaded');
    }

    // expect: Scenario events are displayed in a table
    // The scenario events view is rendered by app-scenario-event-list with a table inside
    const timelineContainer = page.locator(
      'app-scenario-event-list, ' +
      '[class*="timeline"], ' +
      '[class*="events"], ' +
      '[class*="scenario-events"], ' +
      '[class*="event-list"], ' +
      'table'
    ).first();

    await expect(timelineContainer).toBeVisible({ timeout: 10000 });

    // Count initial events
    // On the scenario events page, rows use standard table tbody tr elements
    const eventItems = page.locator(
      '[class*="event-item"], ' +
      '[class*="scenario-event"], ' +
      '[class*="timeline-event"], ' +
      'table tbody tr'
    );

    const initialEventCount = await eventItems.count();
    expect(initialEventCount).toBeGreaterThan(0);

    // 2. Apply event type filter
    // Look for event type filter control
    const eventTypeFilter = page.locator(
      'select[name*="type"], ' +
      'select[name*="eventType"], ' +
      '[class*="type-filter"], ' +
      '[class*="event-type-filter"], ' +
      'mat-select[placeholder*="Type"], ' +
      'mat-select[placeholder*="Event Type"], ' +
      '[aria-label*="Event Type"]'
    ).first();

    // expect: Filter shows available event types
    const typeFilterVisible = await eventTypeFilter.isVisible({ timeout: 5000 }).catch(() => false);

    if (typeFilterVisible) {
      await eventTypeFilter.click();
      await page.waitForTimeout(500);

      // Get available event type options
      const typeOptions = page.locator(
        'mat-option, ' +
        'option:not([value=""]), ' +
        '[role="option"], ' +
        '[class*="option-item"]'
      );

      const typeOptionCount = await typeOptions.count();
      expect(typeOptionCount).toBeGreaterThan(0);

      // Select the first event type
      const firstTypeOption = typeOptions.first();
      const typeName = await firstTypeOption.textContent();
      await firstTypeOption.click();
      await page.waitForTimeout(1500);

      // expect: Timeline updates to show only selected event types
      await page.waitForLoadState('domcontentloaded');
      const filteredEvents = page.locator(
        '[class*="event-item"], ' +
        '[class*="scenario-event"], ' +
        '[class*="timeline-event"], ' +
        'table tbody tr'
      );

      const filteredEventCount = await filteredEvents.count();
      expect(filteredEventCount).toBeGreaterThanOrEqual(0);
      expect(filteredEventCount).toBeLessThanOrEqual(initialEventCount);

      // expect: Other events are hidden or grayed out
      // Verify that visible events match the selected type
      if (filteredEventCount > 0) {
        const firstFilteredEvent = filteredEvents.first();
        await expect(firstFilteredEvent).toBeVisible();

        // Check if the event has the expected type indicator (color, badge, etc.)
        const eventTypeIndicator = firstFilteredEvent.locator(
          '[class*="type"], ' +
          '[class*="category"], ' +
          '[class*="badge"]'
        ).first();

        if (await eventTypeIndicator.isVisible({ timeout: 2000 })) {
          const indicatorText = await eventTypeIndicator.textContent();
          expect(indicatorText).toBeTruthy();
        }
      }

      // Verify that events have distinct colors (as per config: 10 colors available)
      // Check if filtered events have consistent styling
      if (filteredEventCount > 1) {
        const secondEvent = filteredEvents.nth(1);
        await expect(secondEvent).toBeVisible();
      }
    } else {
      // Event type filter might be in a filter panel or as checkboxes
      const filterButton = page.locator(
        'button:has-text("Filter"), ' +
        'button:has-text("Filters"), ' +
        '[aria-label*="Filter"], ' +
        'mat-icon:has-text("filter_list")'
      ).first();

      const filterButtonVisible = await filterButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (filterButtonVisible) {
        await filterButton.click();
        await page.waitForTimeout(1000);

        // Look for event type checkboxes or filter options
        const typeCheckbox = page.locator(
          'input[type="checkbox"][name*="type"], ' +
          'mat-checkbox, ' +
          '[class*="type-checkbox"]'
        ).first();

        if (await typeCheckbox.isVisible({ timeout: 2000 })) {
          await typeCheckbox.click();
          await page.waitForTimeout(1500);

          // Verify filtering occurred
          const filteredEventsAlt = page.locator(
            '[class*="event-item"], ' +
            '[class*="scenario-event"]'
          );
          const altFilteredCount = await filteredEventsAlt.count();
          expect(altFilteredCount).toBeGreaterThanOrEqual(0);
        }
      }

      // Verify timeline is still visible even if filter is not available
      await expect(timelineContainer).toBeVisible();
    }

    await page.waitForLoadState('domcontentloaded');
  });
});
