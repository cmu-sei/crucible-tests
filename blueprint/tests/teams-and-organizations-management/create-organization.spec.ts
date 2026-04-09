// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Teams and Organizations Management', () => {
  test('Create Organization', async ({ blueprintAuthenticatedPage: page }) => {

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

    // expect: Organizations list table is visible (Angular Material mat-table)
    const orgsList = page.locator('mat-table, [role="table"]').first();
    await expect(orgsList).toBeVisible({ timeout: 10000 });

    // 3. Click 'Add organization' button to open the dropdown menu
    const addOrgButton = page.getByRole('button', { name: 'Add organization' });
    await expect(addOrgButton).toBeVisible({ timeout: 5000 });
    await addOrgButton.click();

    // expect: Dropdown menu with 'New Organization' option appears
    const newOrgMenuItem = page.getByRole('menuitem', { name: 'New Organization' });
    await expect(newOrgMenuItem).toBeVisible({ timeout: 5000 });
    await newOrgMenuItem.click();

    // expect: Organization creation dialog is displayed
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 4. Enter organization details - Long Name (required)
    const longNameField = dialog.getByRole('textbox', { name: 'Long Name' });
    await expect(longNameField).toBeVisible({ timeout: 5000 });
    await longNameField.fill('Cyber Defense Organization');

    // expect: Long Name field accepts input
    await expect(longNameField).toHaveValue('Cyber Defense Organization');

    // 5. Enter Short Name (required)
    const shortNameField = dialog.getByRole('textbox', { name: 'Short Name' });
    await expect(shortNameField).toBeVisible({ timeout: 5000 });
    await shortNameField.fill('CDO');

    // expect: Short Name field accepts input
    await expect(shortNameField).toHaveValue('CDO');

    // 6. Enter Summary (required)
    const summaryField = dialog.getByRole('textbox', { name: 'Summary' });
    await expect(summaryField).toBeVisible({ timeout: 5000 });
    await summaryField.fill('Organization responsible for cybersecurity defense operations');

    // expect: Summary field accepts input
    await expect(summaryField).toHaveValue('Organization responsible for cybersecurity defense operations');

    // 7. Enter Email (required)
    const emailField = dialog.getByRole('textbox', { name: 'Email' });
    await expect(emailField).toBeVisible({ timeout: 5000 });
    await emailField.fill('cdo@example.com');

    // expect: Email field accepts input
    await expect(emailField).toHaveValue('cdo@example.com');

    // 8. Click 'Save' button
    const saveButton = dialog.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();

    // expect: Organization is created successfully and appears in the list
    await page.waitForTimeout(2000);
    const newOrgItem = page.locator('text=Cyber Defense Organization').first();
    await expect(newOrgItem).toBeVisible({ timeout: 10000 });

    // expect: Can now be assigned to teams and used in scenario events
    console.log('Organization created successfully and is now available for team assignment');
  });
});
