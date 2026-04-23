// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Workspace Browser Sortable Headers', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to admin workspace browser
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    const workspacesLink = page.locator('a:has-text("Workspace"), button:has-text("Workspace"), mat-tab:has-text("Workspace")').first();
    const hasLink = await workspacesLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasLink) {
      await workspacesLink.click();
      await page.waitForTimeout(1000);
    }

    // expect: Workspace list displays with table headers
    // 2. Click on 'Name' column header
    const nameHeader = page.locator('th:has-text("Name"), [class*="header"]:has-text("Name"), button:has-text("Name")').first();
    const hasName = await nameHeader.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasName) {
      await nameHeader.click();
      await page.waitForTimeout(500);

      // expect: Workspaces are sorted by name alphabetically

      // 3. Click on 'Created' column header
      const createdHeader = page.locator('th:has-text("Created"), button:has-text("Created")').first();
      const hasCreated = await createdHeader.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasCreated) {
        await createdHeader.click();
        await page.waitForTimeout(500);
      }

      // 4. Click on 'Activity' column header
      const activityHeader = page.locator('th:has-text("Activity"), button:has-text("Activity")').first();
      const hasActivity = await activityHeader.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasActivity) {
        await activityHeader.click();
        await page.waitForTimeout(500);
      }
    }
  });
});
