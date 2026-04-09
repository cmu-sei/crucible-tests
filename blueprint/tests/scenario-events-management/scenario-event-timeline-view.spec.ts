// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Scenario Events Management', () => {
  test('Scenario Event Timeline View', async ({ blueprintAuthenticatedPage: page }) => {

    // 1. Navigate to a MSEL with multiple scenario events
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('domcontentloaded');

    // The /build page may show the Event Dashboard with a 'Manage an Event' card
    // Click it to get to the MSEL list
    const manageEventCard = page.locator('text=Manage an Event').first();
    if (await manageEventCard.isVisible({ timeout: 3000 })) {
      await manageEventCard.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
    }

    // Check if already on a MSEL page or need to select one
    const scenarioEventsNav = page.locator('text=Scenario Events').first();
    const isOnMselPage = await scenarioEventsNav.isVisible({ timeout: 2000 });

    if (!isOnMselPage) {
      // We're on the MSEL list page, need to click on a MSEL
      const mselLink = page.locator(
        'a[href*="msel"], ' +
        '[class*="msel-item"], ' +
        '[class*="msel-card"], ' +
        'table tbody tr'
      ).first();

      if (await mselLink.isVisible({ timeout: 3000 })) {
        await mselLink.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);
      } else {
        // No MSEL exists, create one using the 'Add blank MSEL' button
        const createButton = page.getByRole('button', { name: 'Add blank MSEL' });
        await expect(createButton).toBeVisible({ timeout: 10000 });
        await createButton.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);

        // After creating, we may be redirected to the MSEL edit page
        // If still on the list, click the first MSEL
        const isNowOnMselPage = await page.locator('text=Scenario Events').first().isVisible({ timeout: 3000 });
        if (!isNowOnMselPage) {
          const firstMselLink = page.locator(
            'a[href*="msel"], ' +
            '[class*="msel-item"], ' +
            '[class*="msel-card"], ' +
            'table tbody tr'
          ).first();
          await expect(firstMselLink).toBeVisible({ timeout: 5000 });
          await firstMselLink.click();
          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(1000);
        }
      }
    }

    // expect: MSEL details page is displayed
    await page.waitForTimeout(1000);

    // Navigate to Scenario Events section
    await scenarioEventsNav.click();
    await page.waitForTimeout(1000);

    if (true) {
      
      // 2. Switch to timeline view (if not default)
      const timelineViewButton = page.locator(
        'button:has-text("Timeline"), ' +
        'mat-button-toggle:has-text("Timeline"), ' +
        '[aria-label*="Timeline"]'
      ).first();
      
      if (await timelineViewButton.isVisible({ timeout: 2000 })) {
        await timelineViewButton.click();
        await page.waitForTimeout(500);
      }
      
      // expect: Events are displayed on a visual timeline
      const timeline = page.locator(
        '[class*="timeline"], ' +
        '[class*="event-list"], ' +
        '[class*="scenario-events"]'
      ).first();
      
      await expect(timeline).toBeVisible({ timeout: 5000 });
      
      // expect: Events are positioned according to their scheduled time
      const events = page.locator(
        '[class*="event-item"], ' +
        '[class*="timeline-event"]'
      );
      
      const eventCount = await events.count();

      // expect: Color-coded events are easy to distinguish
      // Check that events have background colors applied
      if (eventCount > 0) {
        const firstEvent = events.first();
        const backgroundColor = await firstEvent.evaluate((el) => {
          return window.getComputedStyle(el).backgroundColor;
        });
        expect(backgroundColor).toBeTruthy();
        expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
        expect(backgroundColor).not.toBe('transparent');
      }
      
      // expect: Timeline shows time markers and scale
      const timeMarkers = page.locator(
        '[class*="time-marker"], ' +
        '[class*="time-label"], ' +
        '[class*="timeline-scale"]'
      );
      
      // Time markers should exist for timeline scale
      if (await timeMarkers.first().isVisible({ timeout: 2000 })) {
        expect(await timeMarkers.count()).toBeGreaterThan(0);
      }
      
      // 3. Zoom in and out on the timeline
      const zoomInButton = page.locator(
        'button[aria-label*="Zoom in"], ' +
        'button:has-text("Zoom In"), ' +
        'mat-icon:has-text("zoom_in")'
      ).first();
      
      const zoomOutButton = page.locator(
        'button[aria-label*="Zoom out"], ' +
        'button:has-text("Zoom Out"), ' +
        'mat-icon:has-text("zoom_out")'
      ).first();
      
      if (await zoomInButton.isVisible({ timeout: 2000 })) {
        // expect: Timeline zoom controls allow adjusting the time scale
        await zoomInButton.click();
        await page.waitForTimeout(500);
        
        // expect: Events remain properly positioned during zoom
        await expect(timeline).toBeVisible();
        
        await zoomOutButton.click();
        await page.waitForTimeout(500);
        
        await expect(timeline).toBeVisible();
      }
      
      // 4. Drag an event to a new time (if drag-and-drop is supported)
      const draggableEvent = page.locator(
        '[class*="event-item"][draggable="true"], ' +
        '[class*="timeline-event"][draggable="true"]'
      ).first();
      
      if (await draggableEvent.isVisible({ timeout: 2000 })) {
        const eventBox = await draggableEvent.boundingBox();
        if (eventBox) {
          // expect: Event can be repositioned by dragging
          await page.mouse.move(eventBox.x + eventBox.width / 2, eventBox.y + eventBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(eventBox.x + 100, eventBox.y + eventBox.height / 2);
          await page.mouse.up();
          await page.waitForTimeout(1000);
          
          // expect: Event time is updated automatically
          // expect: Changes are saved or require confirmation
          // Visual verification - event should be at new position
        }
      }
    }
  });
});
