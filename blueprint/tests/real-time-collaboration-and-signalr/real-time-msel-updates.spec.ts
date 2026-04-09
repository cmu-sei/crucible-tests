// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, chromium, BrowserContext } from '@playwright/test';
import { Services, authenticateBlueprintWithKeycloak } from '../../fixtures';
import path from 'node:path';

test.describe('Real-time Collaboration and SignalR', () => {
  // Verifies that SignalR real-time updates work: when a scenario event is created
  // in one browser window, it automatically appears in another window viewing the
  // same MSEL without a manual refresh.
  test('Real-time MSEL Updates', async ({ page }) => {
    // 1. Open two browser windows, both viewing the same MSEL
    await authenticateBlueprintWithKeycloak(page, 'admin', 'admin');

    // expect: Both windows display the same MSEL details
    await page.waitForLoadState('load');

    // Navigate to the Build page
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('load');

    // Navigate to Project Lagoon TTX MSEL (full name includes " - Admin User")
    const mselLink = page.getByRole('link', { name: 'Project Lagoon TTX - Admin User' });
    await mselLink.click();
    await page.waitForLoadState('load');
    const mselUrl = page.url();

    // Navigate to the Scenario Events tab (in the sidebar navigation)
    await page.getByText('Scenario Events', { exact: true }).click();
    await page.waitForLoadState('load');

    // Open second browser context and window using saved auth state
    const authFile = path.resolve(__dirname, '../../../.auth/user.json');
    const browser = await chromium.launch();
    const context2 = await browser.newContext({
      ignoreHTTPSErrors: true,
      storageState: authFile
    });
    const page2 = await context2.newPage();

    // Navigate to the Build page in second window
    await page2.goto(`${Services.Blueprint.UI}/build`);
    await page2.waitForLoadState('load');

    // Click on the same MSEL link in second window
    const mselLink2 = page2.getByRole('link', { name: 'Project Lagoon TTX - Admin User' });
    await mselLink2.click();
    await page2.waitForLoadState('load');

    // Wait for the page to be fully loaded by checking for a key element
    await page2.getByText('Scenario Events', { exact: true }).waitFor({ timeout: 10000 });

    // Navigate to the Scenario Events tab in second window (in the sidebar navigation)
    await page2.getByText('Scenario Events', { exact: true }).click();
    await page2.waitForLoadState('load');

    // expect: Both windows show the same MSEL Scenario Events
    // Count the existing scenario event rows in both windows
    const initialEventCount1 = await page.locator('table tbody tr').count();
    const initialEventCount2 = await page2.locator('table tbody tr').count();

    // 2. In window 1, create a new scenario event
    // Click the Action List button to open the menu
    await page.locator('button[title="Action List"]').click();
    await page.waitForTimeout(500);

    // Click "Add New Event" from the menu
    await page.locator('text=Add New Event').click();
    await page.waitForTimeout(1000);

    // The Create Event dialog appears with fields like Scenario Event Type,
    // Integration Target, Execution Date/Time, etc. Click Save to create with defaults.
    const saveEventButton = page.getByRole('button', { name: 'Save' });
    await saveEventButton.click();
    await page.waitForTimeout(2000);

    // 3. Observe window 2 without refreshing
    // expect: Window 2 receives real-time update via SignalR
    // expect: New event appears automatically in window 2
    // expect: No manual refresh is required

    // Verify the event was created in window 1
    const updatedEventCount1 = await page.locator('table tbody tr').count();
    expect(updatedEventCount1).toBeGreaterThan(initialEventCount1);

    // 3. Wait for SignalR to propagate the update to window 2 (typically 1-3 seconds)
    await page2.waitForTimeout(5000);

    const finalEventCount2 = await page2.locator('table tbody tr').count();
    const countIncreased = finalEventCount2 > initialEventCount2;

    expect(countIncreased).toBeTruthy();

    // Cleanup
    await context2.close();
    await browser.close();
  });
});
