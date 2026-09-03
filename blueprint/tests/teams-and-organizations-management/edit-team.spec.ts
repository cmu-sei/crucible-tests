// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createTeam,
  deleteTeam,
  navigateToMselSection,
} from '../../test-helpers';

test.describe('Teams and Organizations Management', () => {
  let token: string;
  let mselId: string;
  let mselName: string;
  let teamId: string;

  test.beforeEach(async () => {
    // Seed: create a MSEL with a team
    token = await getBlueprintToken();
    const msel = await createMsel(token);
    mselId = msel.id;
    mselName = msel.name;

    const team = await createTeam(token, mselId, { name: 'Test Team Bravo' });
    teamId = team.id;
  });

  test.afterEach(async () => {
    // Cleanup: delete the team and MSEL
    try {
      if (teamId) await deleteTeam(token, teamId);
    } catch (err) {
      console.warn(`Cleanup failed for team ${teamId}: ${err}`);
    }
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Edit Team', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to the MSEL Teams section
    await navigateToMselSection(page, mselId, 'Teams');

    // expect: Teams table is visible
    const teamsTable = page.getByRole('table').first();
    await expect(teamsTable).toBeVisible({ timeout: 10000 });

    // Click the edit button for the seeded team
    const editButton = page.getByRole('button', { name: 'Edit Test Team Bravo' });
    await expect(editButton).toBeVisible({ timeout: 10000 });
    await editButton.click();

    // expect: Edit Team dialog appears
    const editDialog = page.getByRole('dialog').first();
    await expect(editDialog).toBeVisible({ timeout: 5000 });

    // expect: Name field is populated with current value
    const nameField = editDialog.getByRole('textbox', { name: 'Name', exact: true });
    await expect(nameField).toBeVisible({ timeout: 3000 });
    await expect(nameField).toHaveValue('Test Team Bravo');

    // Modify the team name
    const editedName = 'Test Team Bravo - Edited';
    await nameField.fill(editedName);

    // expect: Changes can be made to the name field
    await expect(nameField).toHaveValue(editedName);

    // Click 'Save' button to save the changes
    const saveButton = editDialog.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeVisible({ timeout: 3000 });
    await saveButton.click();

    // expect: Dialog closes after saving
    await expect(editDialog).not.toBeVisible({ timeout: 5000 });

    // expect: The edited team name is visible in the teams table
    const editedTeamRow = page.getByRole('row').filter({ hasText: editedName });
    await expect(editedTeamRow).toBeVisible({ timeout: 10000 });
  });
});
