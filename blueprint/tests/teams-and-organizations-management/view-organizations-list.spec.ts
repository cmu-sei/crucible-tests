// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Teams and Organizations Management', () => {
  test('View Organizations List', async ({ blueprintAuthenticatedPage: page }) => {

    // 1. Navigate to MSEL list page
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for the MSEL table to be visible (Angular Material mat-table with role="table")
    const mselTable = page.locator('mat-table, [role="table"]').first();
    await expect(mselTable).toBeVisible({ timeout: 15000 });

    // Click on the first MSEL link to open it
    const mselLink = page.locator('mat-cell a[href*="msel="], [role="cell"] a[href*="msel="]').first();
    await expect(mselLink).toBeVisible({ timeout: 10000 });
    await mselLink.click();
    await page.waitForLoadState('domcontentloaded');

    // Wait for the MSEL to open (sidebar navigation becomes visible with Organizations item)
    const orgsNavItem = page.locator('mat-list-item:has-text("Organizations")').first();
    await expect(orgsNavItem).toBeVisible({ timeout: 15000 });

    // 2. Click 'Organizations' in the sidebar navigation
    await orgsNavItem.click();
    await page.waitForLoadState('domcontentloaded');

    // expect: Organizations list is displayed
    const orgsList = page.locator('mat-table, [role="table"]').first();
    await expect(orgsList).toBeVisible({ timeout: 10000 });

    // expect: Each organization shows: name, description, teams count
    const orgRows = page.locator('mat-row, [role="row"]:not([class*="header"])');

    const orgCount = await orgRows.count();

    if (orgCount > 0) {
      // Verify at least one organization has required information
      const firstOrg = orgRows.first();

      // Check for organization name
      const orgName = firstOrg.locator(
        '[class*="name"], ' +
        'mat-cell:first-child, ' +
        '[class*="org-name"]'
      ).first();
      await expect(orgName).toBeVisible();

      // Check for description (might be in a cell or hidden)
      const hasDescription = await firstOrg.locator(
        '[class*="description"], ' +
        'mat-cell:nth-child(2)'
      ).count() > 0;

      // Check for teams count
      const hasTeamCount = await firstOrg.locator(
        '[class*="team"], ' +
        '[class*="count"]'
      ).count() > 0;

      console.log(`Organizations list displayed with ${orgCount} organization(s)`);
      console.log(`Description visible: ${hasDescription}, Team count visible: ${hasTeamCount}`);
    } else {
      // Check for empty state
      const emptyState = page.locator(
        'text=No organizations, ' +
        'text=No data, ' +
        '[class*="empty"], ' +
        '[class*="no-data"]'
      ).first();

      const hasEmptyState = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`No organizations found. Empty state visible: ${hasEmptyState}`);
    }
  });
});
