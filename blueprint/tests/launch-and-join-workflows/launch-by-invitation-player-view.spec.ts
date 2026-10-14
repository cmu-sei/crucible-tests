// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: blueprint/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import { request as playwrightRequest } from '@playwright/test';
import {
  getBlueprintToken,
  blueprintCall,
  createMsel,
  deleteMsel,
  getMsel,
  updateMsel,
  createTeam,
  createInvitation,
} from '../../test-helpers';

async function getPlayerViewTeams(token: string, viewId: string): Promise<any[]> {
  const ctx = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const res = await ctx.get(`${Services.Player.API.replace(/\/$/, '')}/api/views/${viewId}/teams`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok(), `Player view teams: ${await res.text()}`).toBe(true);
    return await res.json();
  } finally {
    await ctx.dispose();
  }
}

test.describe('Launch and Join Event Workflows', () => {
  let token: string;
  let templateId: string | undefined;
  let launchedId: string | undefined;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
  });

  test.afterEach(async () => {
    try {
      if (launchedId) {
        const removed = await blueprintCall(token, `/api/msels/${launchedId}/integrations`, { method: 'DELETE' });
        if (removed.ok) {
          await expect
            .poll(async () => (await getMsel(token, launchedId!)).playerViewId ?? null, { timeout: 60_000 })
            .toBeNull();
        }
        await deleteMsel(token, launchedId);
      }
    } catch (err) {
      console.warn(`Cleanup failed for launched MSEL ${launchedId}: ${err}`);
    }
    if (templateId) await deleteMsel(token, templateId);
    templateId = undefined;
    launchedId = undefined;
  });

  test('Launching by invitation puts the MSEL, its view and its teams on one Player view', async () => {
    const template = await createMsel(token, { isTemplate: true, status: 'Approved' });
    templateId = template.id;
    await updateMsel(token, template.id, { usePlayer: true });
    const team = await createTeam(token, template.id, { name: 'Blue Team', shortName: 'BLUE' });
    await createInvitation(token, template.id, team.id);

    // 1. Launch the template through its invitation
    const launch = await blueprintCall<any>(token, `/api/msels/${template.id}/launch?teamId=${team.id}`, { method: 'POST' });
    expect(launch.ok, launch.text).toBe(true);
    launchedId = launch.data.id;
    const viewId = launch.data.playerViewId;
    expect(viewId).toBeTruthy();

    // expect: the launched MSEL deploys and stores the view ID it returned
    await expect
      .poll(async () => (await getMsel(token, launchedId!)).status, { timeout: 120_000 })
      .toBe('Deployed');
    expect((await getMsel(token, launchedId!)).playerViewId).toBe(viewId);

    // expect: the MSEL's team is in that view
    const teams = await getPlayerViewTeams(token, viewId);
    expect(teams.map(t => t.name)).toContain('Blue Team');
  });
});
