// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Group Management in Admin', () => {
  test('View Groups List', async ({ steamfitterAuthenticatedPage: page }) => {
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    await sidebar.locator('text=Groups').first().click();
    await page.waitForTimeout(1000);

    // Verify groups list is displayed (table with "Group Name" header)
    const groupsList = page.locator('table').first();
    await expect(groupsList).toBeVisible({ timeout: 10000 });

    // Verify the add button (+ icon) is present in the table header
    const addButton = groupsList.locator('button:not([disabled])').first();
    await expect(addButton).toBeVisible({ timeout: 10000 });
  });
});
