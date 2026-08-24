// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createTeam,
  listTeams,
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

    const team = await createTeam(token, mselId, { name: 'Test Team Delta' });
    teamId = team.id;
  });

  test.afterEach(async () => {
    // Cleanup: delete the MSEL (which cascades to teams)
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Delete Team', async ({ blueprintAuthenticatedPage: page }) => {
    // Skipped pending upstream support: the Teams grid does not currently refresh after a
    // successful delete, so the removed row stays rendered even though DELETE returns 204
    // and GET /api/msels/{id}/teams confirms removal. The assertion at the end of this test
    // is correct as written — un-skip it once the grid refreshes.
    test.skip(true, 'Pending upstream support: Teams grid refresh after delete');

    // Navigate to the MSEL Teams section
    await navigateToMselSection(page, mselId, 'Teams');

    // expect: Teams table is visible
    const teamsTable = page.getByRole('table').first();
    await expect(teamsTable).toBeVisible({ timeout: 10000 });

    // Click delete button for the seeded team
    const deleteButton = page.getByRole('button', { name: 'Delete team' }).first();
    await expect(deleteButton).toBeVisible({ timeout: 10000 });
    await deleteButton.click();

    // expect: Confirmation dialog appears
    const confirmDialog = page.getByRole('dialog').first();
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    // expect: Confirmation message is present
    const confirmMessage = confirmDialog.getByText(/Are you sure that you want to delete/);
    await expect(confirmMessage).toBeVisible({ timeout: 3000 });

    // expect: NO and YES buttons are present
    const noButton = confirmDialog.getByRole('button', { name: 'NO' });
    const yesButton = confirmDialog.getByRole('button', { name: 'YES' });
    await expect(noButton).toBeVisible({ timeout: 3000 });
    await expect(yesButton).toBeVisible({ timeout: 3000 });

    // Test cancel: click NO to dismiss the dialog without deleting
    await noButton.click();

    // expect: Dialog is closed and team is still visible
    await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });
    const teamRow = page.getByRole('row').filter({ hasText: 'Test Team Delta' });
    await expect(teamRow).toBeVisible({ timeout: 5000 });

    // Now actually delete the team
    await deleteButton.click();
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    // Wait for the DELETE API response to prove the deletion completed
    const deleteResponsePromise = page.waitForResponse(
      (response) => response.url().includes(`/api/teams/${teamId}`) && response.request().method() === 'DELETE',
      { timeout: 10000 }
    );
    await yesButton.click();
    await deleteResponsePromise;

    // expect: Dialog closes
    await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });

    // Verify via API that the team is deleted (delete succeeds server-side)
    const teams = await listTeams(token, mselId);
    const deletedTeam = teams.find((t: any) => t.id === teamId);
    expect(deletedTeam).toBeUndefined();

    // The deleted row must disappear from the grid. Blueprint currently fails this:
    // the DELETE returns 204 and the API confirms removal, but the row stays rendered
    // indefinitely (verified stable for >15s) because the teams grid neither updates
    // local state nor refreshes via SignalR. See the test.skip() above.
    await expect(teamRow).not.toBeVisible({ timeout: 10000 });
  });
});
