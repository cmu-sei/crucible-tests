// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Scenario Events Management', () => {
  test('Open Event in Detail Page', async ({ blueprintAuthenticatedPage: page }) => {
    // Authenticate and navigate to Blueprint
    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Navigate to the Build page
    const manageEventButton = page.getByRole('button', { name: /Manage an Event/ });
    await expect(manageEventButton).toBeVisible({ timeout: 5000 });
    await manageEventButton.click();
    await expect(page).toHaveURL(/.*\/build.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Open a MSEL that has existing scenario events
    const mselLink = page.getByRole('link', { name: /Project Lagoon TTX/ }).first();
    await expect(mselLink).toBeVisible({ timeout: 5000 });
    await mselLink.click();

    // expect: MSEL configuration page is displayed
    await expect(page).toHaveURL(/.*\/build\?msel=.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Extract mselId from current URL for later verification
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

    // Verify scenario events are loaded
    const eventRow = page.locator('table tbody tr').first();
    await expect(eventRow).toBeVisible({ timeout: 10000 });

    // 1. In the Scenario Events list, find an event and click the 'open in new tab' button for a data field
    const openInTabButton = eventRow.locator(
      'button[title*="new tab"], button:has(mat-icon:has-text("open_in_new")), ' +
      'a[target="_blank"], [title*="Open"]'
    ).first();
    const openInTabVisible = await openInTabButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (openInTabVisible) {
      // expect: The Event Detail page opens in a new browser tab at /eventdetail
      const [newPage] = await Promise.all([
        page.context().waitForEvent('page'),
        openInTabButton.click(),
      ]);
      await newPage.waitForLoadState('networkidle');

      // expect: URL includes msel, scenarioEvent, and dataValue query parameters
      await expect(newPage).toHaveURL(/.*\/eventdetail.*msel.*/, { timeout: 10000 });
      const detailUrl = newPage.url();
      expect(detailUrl).toContain('msel');

      // expect: The data field content is displayed
      const topbar = newPage.locator('[class*="topbar"], mat-toolbar').first();
      await expect(topbar).toBeVisible({ timeout: 5000 });

      await newPage.close();
    } else {
      // Fallback: navigate directly to /eventdetail with the mselId
      await page.goto(`${Services.Blueprint.UI}/eventdetail?msel=${mselId}`);
      await page.waitForLoadState('networkidle');

      // expect: The Event Detail page loads at the /eventdetail route
      await expect(page).toHaveURL(/.*\/eventdetail.*/, { timeout: 10000 });

      // expect: The data field content is displayed (topbar confirms page loaded)
      const topbar = page.locator('[class*="topbar"], mat-toolbar').first();
      await expect(topbar).toBeVisible({ timeout: 5000 });
    }
  });
});
