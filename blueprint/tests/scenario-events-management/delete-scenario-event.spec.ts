// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Scenario Events Management', () => {
  test('Delete Scenario Event', async ({ blueprintAuthenticatedPage: page }) => {

    // 1. Navigate to a MSEL with scenario events
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Check if already on a MSEL page or need to select one
    let scenarioEventsNav = page.locator('text=Scenario Events').first();
    let isOnMselPage = await scenarioEventsNav.isVisible({ timeout: 2000 }).catch(() => false);

    if (!isOnMselPage) {
      // We're on the MSEL list page, try to find a MSEL with events
      const mselLinks = page.locator('a[href*="msel"]');
      const mselCount = await mselLinks.count();

      if (mselCount === 0) {
        console.error('No MSEL found in the application. Test cannot proceed without existing MSELs.');
        throw new Error('No MSEL found. Please ensure at least one MSEL exists in Blueprint before running this test.');
      }

      // Try each MSEL to find one with events
      let foundMselWithEvents = false;
      for (let i = 0; i < Math.min(mselCount, 5); i++) {
        await page.goto(`${Services.Blueprint.UI}/build`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(500);

        const mselLink = page.locator('a[href*="msel"]').nth(i);
        await mselLink.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);

        // Check if Scenario Events nav is visible
        scenarioEventsNav = page.locator('text=Scenario Events').first();
        if (await scenarioEventsNav.isVisible({ timeout: 2000 }).catch(() => false)) {
          await scenarioEventsNav.click();
          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(1000);

          // Check if this MSEL has events
          const testEventRows = page.locator('table tbody tr');
          const testEventCount = await testEventRows.count();

          if (testEventCount > 0) {
            console.log(`Found MSEL with ${testEventCount} events`);
            foundMselWithEvents = true;
            break;
          }
        }
      }

      if (!foundMselWithEvents) {
        // Go back to first MSEL as fallback
        await page.goto(`${Services.Blueprint.UI}/build`);
        await page.waitForLoadState('domcontentloaded');
        const firstMselLink = page.locator('a[href*="msel"]').first();
        await firstMselLink.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);
      }
    }

    // expect: MSEL details page is displayed
    // Verify we're on a MSEL page by checking for Scenario Events nav
    scenarioEventsNav = page.locator('text=Scenario Events').first();
    await expect(scenarioEventsNav).toBeVisible({ timeout: 5000 });

    // Navigate to Scenario Events section if not already there
    if (!await page.locator('table tbody tr').first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await scenarioEventsNav.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
    }

    // expect: MSEL details page shows events section

    // Check if there are any events to delete
    const eventRows = page.locator('table tbody tr');
    const eventCount = await eventRows.count();

    if (eventCount === 0) {
      console.error('No scenario events found in any MSEL. Please manually add events to at least one MSEL before running this test.');
      throw new Error('No scenario events found in any checked MSEL. Please create at least one scenario event before running this test.');
    }

    console.log(`Found ${eventCount} events in the current MSEL`);

    // 2. Click the Action List button for the first event to open the menu
    const actionListButton = page.getByRole('button', { name: /Event \d+ Action List/ }).first();
    await expect(actionListButton).toBeVisible({ timeout: 5000 });
    await actionListButton.click();

    // Wait for the menu to appear
    await page.waitForTimeout(500);

    // Click the Delete option from the menu
    const deleteMenuItem = page.locator('menuitem:has-text("Delete"), [role="menuitem"]:has-text("Delete")').first();
    await expect(deleteMenuItem).toBeVisible({ timeout: 5000 });
    await deleteMenuItem.click();

    // expect: A confirmation dialog appears
    await page.waitForTimeout(500);
    const confirmDialog = page.getByRole('dialog', { name: 'Delete Event' });
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    // 3. Click 'Cancel' or 'No'
    const cancelButton = page.getByRole('button', { name: /No|Cancel/i });
    await cancelButton.click();

    // expect: Dialog closes
    await page.waitForTimeout(500);
    await expect(confirmDialog).not.toBeVisible();

    // expect: Event is not deleted
    const countAfterCancel = await eventRows.count();
    expect(countAfterCancel).toBe(eventCount);

    // 4. Click the Action List button again to open the menu
    await actionListButton.click();
    await page.waitForTimeout(500);

    // Click the Delete option from the menu again
    await deleteMenuItem.click();

    // Wait for dialog to appear again
    const confirmDialog2 = page.getByRole('dialog', { name: 'Delete Event' });
    await expect(confirmDialog2).toBeVisible({ timeout: 5000 });

    // Click confirm/delete button
    const confirmButton = page.getByRole('button', { name: /Yes|Delete|Confirm|OK/i });
    await confirmButton.click();

    // expect: The event is deleted successfully
    // Note: The application may show a success notification, but it might auto-dismiss quickly
    // The primary verification is that the event count decreases

    // Wait for the deletion to complete and the UI to update
    await page.waitForTimeout(1000);
    await page.waitForLoadState('domcontentloaded');

    // expect: Event is removed from the timeline
    const countAfterDelete = await eventRows.count();
    expect(countAfterDelete).toBe(eventCount - 1);
  });
});
