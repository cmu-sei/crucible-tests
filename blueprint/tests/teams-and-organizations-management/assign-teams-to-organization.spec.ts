// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Teams and Organizations Management', () => {
  test('Assign Teams to Organization', async ({ blueprintAuthenticatedPage: page }) => {

    // 1. Navigate to the admin Organizations section
    // Organizations are managed under /admin, not a standalone /organizations route
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // expect: Admin page is loaded
    await expect(page).toHaveURL(/\/admin/);

    // Click on "Organizations" in the left sidebar navigation
    const orgsNavItem = page.locator('mat-list-item', { hasText: 'Organizations' }).first();
    await expect(orgsNavItem).toBeVisible({ timeout: 10000 });
    await orgsNavItem.click();
    await page.waitForTimeout(500);

    // expect: Organizations list is displayed with a mat-table
    const orgsTable = page.locator('mat-table, table').first();
    await expect(orgsTable).toBeVisible({ timeout: 10000 });

    // expect: Organization rows (mat-row) are visible
    const orgRows = page.locator('mat-row');
    const orgCount = await orgRows.count();

    if (orgCount > 0) {
      console.log(`Found ${orgCount} organization(s) in the admin list`);

      // Click on the first organization row to verify it is clickable
      const firstOrgRow = orgRows.first();
      await expect(firstOrgRow).toBeVisible({ timeout: 5000 });

      // Click the edit button for the first organization to view its details
      // Edit buttons use title="Edit <org name>"
      const editButton = page.locator('button[title^="Edit"]').first();
      await expect(editButton).toBeVisible({ timeout: 5000 });
      await editButton.click();

      // expect: Organization edit dialog is displayed
      const editDialog = page.locator('mat-dialog-container, [role="dialog"]').first();
      await expect(editDialog).toBeVisible({ timeout: 5000 });

      // expect: Dialog contains organization fields
      const longNameField = page.locator('input[placeholder*="Long Name"]');
      await expect(longNameField).toBeVisible({ timeout: 3000 });

      // Close the dialog
      const cancelButton = page.locator('button', { hasText: 'Cancel' }).first();
      if (await cancelButton.isVisible({ timeout: 2000 })) {
        await cancelButton.click();
        await page.waitForTimeout(500);
      }
    } else {
      // If no organizations exist, verify the empty state or add button is present
      const addButton = page.locator('button[title="Add a template organization"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      console.log('No organizations found - verified add button is present');
    }

    // NOTE: In Blueprint UI, organizations and teams are parallel entities under an MSEL.
    // There is no direct "assign teams to organization" feature in the admin Organizations section.
    // Teams are managed within individual MSELs under the "Teams" tab at /build?msel=<id>.
    // Organizations are managed under the "Organizations" tab within the same MSEL.
    // Both reference the same MSEL but are not directly linked to each other.

    // 2. Navigate to a MSEL to verify both Teams and Organizations sections exist
    await page.goto(`${Services.Blueprint.UI}/build`);
    // Wait for the MSEL list page to be ready
    // Use a longer timeout since the page may need to authenticate/redirect
    await expect(page).toHaveURL(/\/build/, { timeout: 15000 });
    await page.waitForTimeout(1000);

    // Wait for MSELs table to load
    // The MSEL list uses Angular Material's mat-table which renders as <mat-table role="table">
    const mselTable = page.locator('mat-table').first();
    await expect(mselTable).toBeVisible({ timeout: 15000 });

    // Click on the first available MSEL link
    const mselLink = page.locator('a[href*="/build?msel="]').first();
    const mselCount = await mselLink.count();

    if (mselCount > 0) {
      await mselLink.click();
      await page.waitForTimeout(1000);

      // expect: MSEL sidebar shows Teams navigation item
      const teamsNavItem = page.locator('mat-list-item', { hasText: 'Teams' }).first();
      await expect(teamsNavItem).toBeVisible({ timeout: 10000 });

      // expect: MSEL sidebar shows Organizations navigation item
      const organizationsNavItem = page.locator('mat-list-item', { hasText: 'Organizations' }).first();
      await expect(organizationsNavItem).toBeVisible({ timeout: 5000 });

      // Navigate to the Teams section within the MSEL
      await teamsNavItem.click();
      await page.waitForTimeout(500);

      // expect: Teams table is visible
      const teamsTable = page.locator('mat-table, table').first();
      await expect(teamsTable).toBeVisible({ timeout: 5000 });

      console.log('Teams and Organizations sections verified within MSEL');
    }
  });
});
