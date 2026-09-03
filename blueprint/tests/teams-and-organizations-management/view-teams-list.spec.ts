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
    const msel = await createMsel(token, { name: undefined }); // auto-generated unique name
    mselId = msel.id;
    mselName = msel.name;

    const team = await createTeam(token, mselId, { name: 'Test Team Alpha' });
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

  test('View Teams List', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to the MSEL Teams section
    await navigateToMselSection(page, mselId, 'Teams');

    // expect: Teams table is visible
    const teamsTable = page.getByRole('table').first();
    await expect(teamsTable).toBeVisible({ timeout: 10000 });

    // expect: The seeded team is present
    const teamRow = page.getByRole('row').filter({ hasText: 'Test Team Alpha' });
    await expect(teamRow).toBeVisible({ timeout: 5000 });

    console.log(`Teams list displayed with seeded team: Test Team Alpha`);
  });
});
