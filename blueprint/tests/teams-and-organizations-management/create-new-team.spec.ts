// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  deleteTeam,
  listTeams,
  navigateToMselSection,
} from '../../test-helpers';

test.describe('Teams and Organizations Management', () => {
  let token: string;
  let mselId: string;
  let mselName: string;
  let createdTeamId: string | undefined;

  test.beforeEach(async () => {
    // Seed: create a MSEL
    token = await getBlueprintToken();
    const msel = await createMsel(token);
    mselId = msel.id;
    mselName = msel.name;
  });

  test.afterEach(async () => {
    // Cleanup: delete any created team and the MSEL
    try {
      if (createdTeamId) await deleteTeam(token, createdTeamId);
    } catch (err) {
      console.warn(`Cleanup failed for team ${createdTeamId}: ${err}`);
    }
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Create New Team', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to the MSEL Teams section
    await navigateToMselSection(page, mselId, 'Teams');

    // expect: Teams list table is visible
    const teamsList = page.locator('table').first();
    await expect(teamsList).toBeVisible({ timeout: 10000 });

    // Click 'Add a team' button to open the dropdown menu
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

    // Enter 'Blue Team' in the Name field
    const nameField = dialog.getByRole('textbox', { name: 'Name', exact: true });
    await expect(nameField).toBeVisible({ timeout: 5000 });
    await nameField.fill('Blue Team');

    // expect: Name field accepts input
    await expect(nameField).toHaveValue('Blue Team');

    // Enter a short name (required field)
    const shortNameField = dialog.getByRole('textbox', { name: 'Short Name' });
    await expect(shortNameField).toBeVisible({ timeout: 5000 });
    await shortNameField.fill('BT');

    // expect: Short Name field accepts input
    await expect(shortNameField).toHaveValue('BT');

    // Click 'Save' button
    const saveButton = dialog.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();

    // expect: Dialog closes
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // expect: The team is created successfully and appears in the teams list
    const newTeamRow = page.getByRole('row').filter({ hasText: 'Blue Team' });
    await expect(newTeamRow).toBeVisible({ timeout: 10000 });

    // Capture the team ID for cleanup
    const teams = await listTeams(token, mselId);
    const createdTeam = teams.find((t: any) => t.name === 'Blue Team');
    if (createdTeam) {
      createdTeamId = createdTeam.id;
    }
  });
});
