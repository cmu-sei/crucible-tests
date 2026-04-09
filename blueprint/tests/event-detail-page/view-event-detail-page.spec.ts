// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Event Detail Page', () => {
  test('View Event Detail Page', async ({ blueprintAuthenticatedPage: page }) => {
    // Authenticate and navigate to Blueprint
    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Click on "Manage an Event" button to navigate to Blueprint page
    const manageEventButton = page.getByRole('button', { name: /Manage an Event/ });
    await expect(manageEventButton).toBeVisible({ timeout: 5000 });
    await manageEventButton.click();

    // Wait for navigation to /build page
    await expect(page).toHaveURL(/.*\/build.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Open the "Project Lagoon TTX" MSEL which has existing scenario events
    const mselLink = page.getByRole('link', { name: /Project Lagoon TTX/ }).first();
    await expect(mselLink).toBeVisible({ timeout: 5000 });
    await mselLink.click();

    // expect: MSEL configuration page is displayed
    await expect(page).toHaveURL(/.*\/build\?msel=.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Extract mselId from current URL
    const currentUrl = page.url();
    const mselIdMatch = currentUrl.match(/msel=([^&]+)/);
    expect(mselIdMatch).toBeTruthy();
    const mselId = mselIdMatch![1];

    // Navigate to Scenario Events section
    const scenarioEventsNav = page.locator(
      'a:has-text("Scenario Events"), mat-list-item:has-text("Scenario Events")'
    ).first();
    await expect(scenarioEventsNav).toBeVisible({ timeout: 5000 });
    await scenarioEventsNav.click();
    await page.waitForLoadState('networkidle');

    // Verify scenario events are loaded - find the first event row
    const eventRow = page.locator('table tbody tr').first();
    await expect(eventRow).toBeVisible({ timeout: 10000 });

    // Try to find an "open in new tab" button on the first event row to get the event detail URL
    const openInTabButton = eventRow.locator(
      'button[title*="new tab"], button:has(mat-icon:has-text("open_in_new")), ' +
      'a[target="_blank"], [title*="Open"]'
    ).first();
    const openInTabVisible = await openInTabButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (openInTabVisible) {
      // Open event detail page via "open in new tab" button
      const [newPage] = await Promise.all([
        page.context().waitForEvent('page'),
        openInTabButton.click(),
      ]);
      await newPage.waitForLoadState('networkidle');

      // expect: The Event Detail page opens at /eventdetail with msel param
      await expect(newPage).toHaveURL(/.*\/eventdetail.*msel.*/, { timeout: 10000 });

      // expect: A Blueprint topbar is displayed
      const topbar = newPage.locator('[class*="topbar"], mat-toolbar').first();
      await expect(topbar).toBeVisible({ timeout: 5000 });

      await newPage.close();
    } else {
      // Fallback: navigate directly to /eventdetail with the mselId
      await page.goto(`${Services.Blueprint.UI}/eventdetail?msel=${mselId}`);
      await page.waitForLoadState('networkidle');

      // expect: The Event Detail page loads at the /eventdetail route
      await expect(page).toHaveURL(/.*\/eventdetail.*/, { timeout: 10000 });

      // expect: A Blueprint topbar is displayed
      const topbar = page.locator('[class*="topbar"], mat-toolbar').first();
      await expect(topbar).toBeVisible({ timeout: 5000 });
    }
  });
});
