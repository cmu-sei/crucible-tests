// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  updateMsel,
  createPlayerApplication,
  deletePlayerApplication,
  deleteTeam,
  listTeams,
  navigateToMselSection,
} from '../../test-helpers';

// The Player Applications list sits in a collapsed expansion panel
async function openPlayerApplicationsPanel(page: Page) {
  const header = page.locator('mat-expansion-panel-header').filter({ hasText: 'Player Applications' });
  if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'true');
}

test.describe('Player Applications', () => {
  let token: string;
  let mselId: string;
  let appId: string | undefined;
  let appName: string;
  let createdTeamId: string | undefined;

  test.beforeEach(async () => {
    // Seed: a MSEL that uses Player, with one Player application and no teams
    token = await getBlueprintToken();
    const msel = await createMsel(token);
    mselId = msel.id;
    await updateMsel(token, mselId, { usePlayer: true });
    const app = await createPlayerApplication(token, mselId);
    appId = app.id;
    appName = app.name;
  });

  test.afterEach(async () => {
    try {
      if (createdTeamId) await deleteTeam(token, createdTeamId);
    } catch (err) {
      console.warn(`Cleanup failed for team ${createdTeamId}: ${err}`);
    }
    try {
      if (appId) await deletePlayerApplication(token, appId);
    } catch (err) {
      console.warn(`Cleanup failed for Player application ${appId}: ${err}`);
    }
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('A team created on the Teams tab can be added to an application without a reload', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const teamName = `New Team ${Date.now()}`;

    // 1. Open Player Apps first, so the tab has already built its team list
    await navigateToMselSection(page, mselId, 'Player Apps');
    await openPlayerApplicationsPanel(page);
    await expect(page.getByRole('row').filter({ hasText: appName })).toBeVisible({ timeout: 10000 });

    // 2. Create a team on the Teams tab
    await page.locator('mat-list-item').filter({ hasText: 'Teams' }).first().click();
    await page.getByRole('button', { name: 'Add a team' }).click();
    await page.getByRole('menuitem', { name: 'New Team' }).click();
    const dialog = page.locator('[role="dialog"]').first();
    await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill(teamName);
    await dialog.getByRole('textbox', { name: 'Short Name' }).fill('NEWT');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('row').filter({ hasText: teamName })).toBeVisible({ timeout: 10000 });
    createdTeamId = (await listTeams(token, mselId)).find((t: any) => t.name === teamName)?.id;

    // 3. Back on Player Apps, open the application's team picker
    await page.locator('mat-list-item').filter({ hasText: 'Player Apps' }).first().click();
    await openPlayerApplicationsPanel(page);
    await page.getByRole('row').filter({ hasText: appName }).first().click();

    // expect: The new team is offered under MSEL Teams, and adding it moves it to the application
    const addButton = page.getByRole('button', { name: `Add ${teamName}` });
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();
    await expect(page.locator('.mat-table-player-application-teams')).toContainText('NEWT', { timeout: 10000 });
    await expect(addButton).toBeHidden();
  });
});
