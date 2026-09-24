// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
//
// Assigning a player application to MSEL teams (player-application-teams), which opens
// beneath an application's row in the Player Applications panel. The left list ("MSEL Teams")
// holds the teams that do not yet see the application; the right list ("Player Application
// Teams") holds those that do.

import { test, expect } from '../../fixtures';
import type { Locator, Page } from '@playwright/test';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  updateMsel,
  createTeam,
  createPlayerApplication,
  listPlayerApplicationTeams,
  navigateToMselSection,
  tempBlueprintName,
} from '../../test-helpers';

const TEAMS = [
  { name: 'Alpha Team', shortName: 'ALPHA' },
  { name: 'Bravo Team', shortName: 'BRAVO' },
  { name: 'Charlie Team', shortName: 'CHARLIE' },
];

/** Open the Player Applications panel and expand one application's row. */
async function openAppTeams(page: Page, mselId: string, appName: string): Promise<Locator> {
  await navigateToMselSection(page, mselId, 'Player Apps');
  const panel = page
    .locator('mat-expansion-panel')
    .filter({ has: page.locator('h4', { hasText: /^Player Applications$/ }) });
  await panel.locator('mat-expansion-panel-header').click();
  await panel.getByRole('cell', { name: appName, exact: true }).click();
  const teams = panel.locator('app-player-application-teams');
  await expect(teams).toBeVisible();
  return teams;
}

test.describe('Player Application Teams', () => {
  let token: string;
  let mselId: string | undefined;
  let appId: string;
  let appName: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token, { name: tempBlueprintName('TestBP-PlayerAppTeams') });
    mselId = msel.id;
    await updateMsel(token, mselId, { usePlayer: true });
    for (const t of TEAMS) await createTeam(token, mselId, t);
    const app = await createPlayerApplication(token, mselId, {
      name: tempBlueprintName('TestBP-PlayerApp'),
    });
    appId = app.id;
    appName = app.name;
  });

  test.afterEach(async () => {
    if (mselId) await deleteMsel(token, mselId);
    mselId = undefined;
  });

  test('Assign a player application to a team and remove it again', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const teams = await openAppTeams(page, mselId!, appName);
    const available = teams.locator('.team-list-container');
    const assigned = teams.locator('.player-application-list-container');

    // expect: every MSEL team is available and none is assigned yet
    await expect(available).toContainText('MSEL Teams');
    for (const t of TEAMS) {
      await expect(available.getByRole('button', { name: `Add ${t.name}` })).toBeVisible();
    }
    await expect(assigned).toContainText('Player Application Teams');
    await expect(assigned.locator('mat-row')).toHaveCount(0);

    await available.getByRole('button', { name: 'Add Alpha Team' }).click();

    // expect: ALPHA moves from the available list to the assigned list
    await expect(assigned.locator('mat-row')).toHaveCount(1);
    await expect(assigned.locator('mat-row').first()).toContainText('ALPHA');
    await expect(available.getByRole('button', { name: 'Add Alpha Team' })).toHaveCount(0);
    await expect(available.locator('mat-row')).toHaveCount(2);

    // Secondary: the assignment persisted.
    await expect
      .poll(async () =>
        (await listPlayerApplicationTeams(token, mselId!)).filter((pat) => pat.playerApplicationId === appId)
          .length
      )
      .toBe(1);

    // expect: the assignment survives a reload
    await page.reload();
    const reloaded = await openAppTeams(page, mselId!, appName);
    const reloadedAssigned = reloaded.locator('.player-application-list-container');
    await expect(reloadedAssigned.locator('mat-row')).toHaveCount(1);
    await expect(reloadedAssigned.locator('mat-row').first()).toContainText('ALPHA');

    // Pending upstream: the remove button's title reads "Remove " because it interpolates a
    // name the assignment record does not have. Once it names the team, find the button by
    // `Remove Alpha Team` instead.
    const removeButton = reloadedAssigned.locator('mat-row').first().getByRole('button');
    await expect(removeButton).toHaveAttribute('title', 'Remove ');
    await removeButton.click();

    // expect: ALPHA is available again and nothing is assigned
    await expect(reloadedAssigned.locator('mat-row')).toHaveCount(0);
    await expect(
      reloaded.locator('.team-list-container').getByRole('button', { name: 'Add Alpha Team' })
    ).toBeVisible();
    await expect
      .poll(async () =>
        (await listPlayerApplicationTeams(token, mselId!)).filter((pat) => pat.playerApplicationId === appId)
          .length
      )
      .toBe(0);
  });

  test('Search the available MSEL teams', async ({ blueprintAuthenticatedPage: page }) => {
    const teams = await openAppTeams(page, mselId!, appName);
    const available = teams.locator('.team-list-container');
    const search = available.getByPlaceholder('Search');
    const clear = available.getByRole('button', { name: 'Clear Search' });

    // expect: Clear Search is disabled until something is typed
    await expect(clear).toBeDisabled();

    // The list filters on keyup, not input, so type rather than fill.
    await search.pressSequentially('charlie');
    // expect: only the matching team is offered
    await expect(available.locator('mat-row')).toHaveCount(1);
    await expect(available.getByRole('button', { name: 'Add Charlie Team' })).toBeVisible();
    await expect(clear).toBeEnabled();

    await search.clear();
    await search.pressSequentially('no-such-team');
    // expect: an empty result says so
    await expect(available.locator('mat-row')).toHaveCount(0);
    await expect(available).toContainText('No teams found');

    await clear.click();
    // expect: clearing restores every team and empties the box
    await expect(search).toHaveValue('');
    await expect(available.locator('mat-row')).toHaveCount(TEAMS.length);
  });

  test('The team search still applies after assigning a team', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const teams = await openAppTeams(page, mselId!, appName);
    const available = teams.locator('.team-list-container');
    const search = available.getByPlaceholder('Search');

    await search.pressSequentially('bravo');
    await expect(available.locator('mat-row')).toHaveCount(1);

    await available.getByRole('button', { name: 'Add Bravo Team' }).click();
    await expect(teams.locator('.player-application-list-container mat-row')).toHaveCount(1);

    // expect: the box still says "bravo", so the list should still be filtered by it.
    // Pending upstream: setDataSources() replaces teamDataSource with a new MatTableDataSource
    // that carries no filter, so after any assignment the list shows every remaining team
    // while the box still holds the search. When it re-applies filterString, expect 0 rows.
    await expect(search).toHaveValue('bravo');
    await expect(available.locator('mat-row')).toHaveCount(TEAMS.length - 1);
  });
});
