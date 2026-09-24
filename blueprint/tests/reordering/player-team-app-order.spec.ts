// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Reordering a team's Player applications on the Player Apps tab's "Team Application Order"
// panel (PlayerTeamAppOrderComponent). Unlike Scenario Events and Data Fields this list is not
// a drag-and-drop list: each application has "Move player application up/down" buttons, which
// PUT the assignment with its new `displayOrder`; the API renumbers the team's other
// assignments (`UpdateOrdering` in PlayerApplicationTeamService.cs). Everything here is
// Blueprint-local — Player applications and their team assignments are Blueprint records until
// a push — so no real Player is needed.

import { request as playwrightRequest, Page } from '@playwright/test';
import { test, expect, Services } from '../../fixtures';
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

/** Assign a Player application to a team — `POST /api/teamplayerApplications`. */
async function assignPlayerApplicationToTeam(
  token: string,
  playerApplicationId: string,
  teamId: string,
  displayOrder: number
): Promise<void> {
  const ctx = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const r = await ctx.post(`${Services.Blueprint.API}/api/teamplayerApplications`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { playerApplicationId, teamId, displayOrder },
    });
    if (!r.ok()) {
      throw new Error(`assignPlayerApplicationToTeam failed (${r.status()}): ${await r.text()}`);
    }
  } finally {
    await ctx.dispose();
  }
}

/** The expanded team's applications as "displayOrder name" strings, top to bottom. */
async function renderedTeamApps(page: Page): Promise<string[]> {
  const rows = page.locator('app-player-team-app-order .data-panel .data-row').filter({
    has: page.locator('button[title="Move player application down"]'),
  });
  const orders = await rows.locator('.left-value').allInnerTexts();
  const names = await rows.locator('.right-name').allInnerTexts();
  return orders.map((o, i) => `${o.trim()} ${names[i]?.trim()}`);
}

test.describe('Player Application Team Order', () => {
  let token: string;
  let mselId: string;
  let teamLabel: string;
  const appName = {
    first: tempBlueprintName('TestBP-AppOrderFirst'),
    second: tempBlueprintName('TestBP-AppOrderSecond'),
  };

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    mselId = (await createMsel(token)).id;
    // The Player Apps tab only exists on MSELs that integrate with Player.
    await updateMsel(token, mselId, { usePlayer: true });
    const team = await createTeam(token, mselId, {
      name: tempBlueprintName('TestBP-AppOrderTeam'),
      shortName: 'AOT',
    });
    teamLabel = `${team.shortName} - ${team.name}`;
    const first = await createPlayerApplication(token, mselId, { name: appName.first });
    const second = await createPlayerApplication(token, mselId, { name: appName.second });
    await assignPlayerApplicationToTeam(token, first.id, team.id, 1);
    await assignPlayerApplicationToTeam(token, second.id, team.id, 2);
  });

  test.afterEach(async () => {
    // The MSEL delete cascades to its teams, Player applications and their assignments.
    if (mselId) await deleteMsel(token, mselId);
  });

  async function openTeamAppOrder(page: Page): Promise<void> {
    await navigateToMselSection(page, mselId, 'Player Apps');
    await page
      .locator('mat-expansion-panel-header')
      .filter({ hasText: 'Team Application Order' })
      .click();
    await page
      .locator('app-player-team-app-order tr.mat-mdc-row')
      .filter({ hasText: teamLabel })
      .click();
  }

  test('Moving an application down swaps it with the next one and persists', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    // 1. Open the team's application order
    await openTeamAppOrder(page);

    // expect: the team's applications in their assigned order, first one's "up" disabled and
    // last one's "down" disabled
    await expect.poll(() => renderedTeamApps(page)).toEqual([
      `1 ${appName.first}`,
      `2 ${appName.second}`,
    ]);
    const firstRow = page
      .locator('app-player-team-app-order .data-row')
      .filter({ hasText: appName.first });
    const secondRow = page
      .locator('app-player-team-app-order .data-row')
      .filter({ hasText: appName.second });
    await expect(firstRow.locator('button[title="Move player application up"]')).toBeDisabled();
    await expect(secondRow.locator('button[title="Move player application down"]')).toBeDisabled();

    // 2. Move the first application down
    const saved = page.waitForResponse(
      (res) =>
        res.request().method() === 'PUT' &&
        res.url().toLowerCase().includes('/api/playerapplicationteams/'),
      { timeout: 15000 }
    );
    await firstRow.locator('button[title="Move player application down"]').click();
    expect((await saved).ok(), 'the moved assignment is saved').toBe(true);

    // expect: the two applications have swapped places and numbers
    await expect.poll(() => renderedTeamApps(page)).toEqual([
      `1 ${appName.second}`,
      `2 ${appName.first}`,
    ]);

    // 3. Reload and reopen the team
    await openTeamAppOrder(page);

    // expect: the new order came from the server
    await expect.poll(() => renderedTeamApps(page)).toEqual([
      `1 ${appName.second}`,
      `2 ${appName.first}`,
    ]);

    // Secondary: the API renumbered both assignments.
    const assignments = await listPlayerApplicationTeams(token, mselId);
    expect(assignments.map((a) => Number(a.displayOrder)).sort((a, b) => a - b)).toEqual([1, 2]);
  });
});
