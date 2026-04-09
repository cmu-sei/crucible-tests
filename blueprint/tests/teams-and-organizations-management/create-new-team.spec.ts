// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Teams and Organizations Management', () => {
  test('Create New Team', async ({ blueprintAuthenticatedPage: page }) => {

    // 1. Navigate to MSEL list page
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for the MSEL table to be visible (Angular Material uses mat-table, not native <table>)
    const mselTable = page.locator('mat-table, [role="table"]').first();
    await expect(mselTable).toBeVisible({ timeout: 15000 });

    // Click on the first MSEL link to open it
    const mselLink = page.locator('mat-cell a[href*="msel="], [role="cell"] a[href*="msel="]').first();
    await expect(mselLink).toBeVisible({ timeout: 10000 });
    await mselLink.click();
    await page.waitForLoadState('domcontentloaded');

    // Wait for the MSEL to open (sidebar navigation becomes visible with Teams item)
    const teamsNavItem = page.locator('mat-list-item:has-text("Teams")').first();
    await expect(teamsNavItem).toBeVisible({ timeout: 15000 });

    // 2. Click 'Teams' in the sidebar navigation
    await teamsNavItem.click();
    await page.waitForLoadState('domcontentloaded');

    // expect: Teams list table is visible (Teams uses a native HTML table)
    const teamsList = page.locator('table').first();
    await expect(teamsList).toBeVisible({ timeout: 10000 });

    // 3. Click 'Add a team' button to open the dropdown menu
    const addTeamButton = page.getByRole('button', { name: 'Add a team' });
    await expect(addTeamButton).toBeVisible({ timeout: 5000 });
    await addTeamButton.click();

    // expect: Dropdown menu with 'New Team' option appears
    const newTeamMenuItem = page.getByRole('menuitem', { name: 'New Team' });
    await expect(newTeamMenuItem).toBeVisible({ timeout: 5000 });
    await newTeamMenuItem.click();

    // expect: Team creation dialog is displayed
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 4. Enter 'Blue Team' in the Name field
    const nameField = dialog.getByRole('textbox', { name: 'Name', exact: true });
    await expect(nameField).toBeVisible({ timeout: 5000 });
    await nameField.fill('Blue Team');

    // expect: Name field accepts input
    await expect(nameField).toHaveValue('Blue Team');

    // 5. Enter a short name (required field)
    const shortNameField = dialog.getByRole('textbox', { name: 'Short Name' });
    await expect(shortNameField).toBeVisible({ timeout: 5000 });
    await shortNameField.fill('BT');

    // expect: Short Name field accepts input
    await expect(shortNameField).toHaveValue('BT');

    // 6. Click 'Save' button
    const saveButton = dialog.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();

    // expect: The team is created successfully and appears in the teams list
    await page.waitForTimeout(2000);
    const newTeamItem = page.locator('text=Blue Team').first();
    await expect(newTeamItem).toBeVisible({ timeout: 10000 });
  });
});
