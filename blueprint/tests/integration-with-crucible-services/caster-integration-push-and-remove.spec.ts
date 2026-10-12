// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: blueprint/blueprint-test-plan.md

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  updateMsel,
  createTeam,
} from '../../test-helpers';
import {
  getCasterToken,
  createCasterTemplate,
  deleteCasterTemplate,
  getCasterWorkspace,
  getBlueprintVarsFile,
  getCasterRun,
  tryUpdateTeam,
  pushIntegrations,
  removeIntegrations,
  waitForMsel,
  CasterTemplate,
  APPLYABLE_TEMPLATE,
} from '../../caster-helpers';

// A push plans and applies a real Caster run, so leave room for a cold terraform job.
test.describe.configure({ timeout: 600_000 });

test.describe('Caster Integration', () => {
  let token: string;
  let casterToken: string;
  let template: CasterTemplate | undefined;
  let mselId: string | undefined;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    casterToken = await getCasterToken();
    template = await createCasterTemplate(casterToken, APPLYABLE_TEMPLATE);
  });

  test.afterEach(async () => {
    try {
      if (mselId) {
        const r = await removeIntegrations(token, mselId);
        if (r.ok) {
          await waitForMsel(token, mselId, m => !m.playerViewId && !m.casterWorkspaceId && m.status !== 'Pulling');
        }
        await deleteMsel(token, mselId);
      }
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
    await deleteCasterTemplate(casterToken, template);
    mselId = undefined;
    template = undefined;
  });

  test('Push deploys a Caster workspace with each team on its variable, and Remove destroys it', async () => {
    const msel = await createMsel(token);
    mselId = msel.id;
    await updateMsel(token, msel.id, {
      usePlayer: true,
      useCaster: true,
      casterDirectoryId: template!.directoryId,
    });

    // Blue Team is mapped to a topology team; Red Cell gets red_cell from its own name.
    const blue = await createTeam(token, msel.id, { name: 'Blue Team', shortName: 'BLUE' });
    const red = await createTeam(token, msel.id, { name: 'Red Cell', shortName: 'RED' });
    const mapped = await tryUpdateTeam(token, blue.id, { casterTeamVariable: 'blue_cell' });
    expect(mapped.ok, mapped.text).toBe(true);

    // 1. Push
    const push = await pushIntegrations(token, msel.id);
    expect(push.ok, push.text).toBe(true);

    // expect: the MSEL reaches Deployed with a Player view, a workspace and a run
    const deployed = await waitForMsel(token, msel.id, m => m.status === 'Deployed', 480_000);
    expect(deployed.playerViewId).toBeTruthy();
    expect(deployed.casterWorkspaceId).toBeTruthy();
    expect(deployed.casterRunId).toBeTruthy();

    // expect: the workspace is in the MSEL's directory and the run applied
    const workspace = await getCasterWorkspace(casterToken, deployed.casterWorkspaceId);
    expect(workspace?.directoryId).toBe(template!.directoryId);
    const run = await getCasterRun(casterToken, deployed.casterRunId);
    expect(String(run.status)).toMatch(/^Applied/);

    // expect: the vars file writes the Player view and each team's Player team ID, which reuses
    // the MSEL team ID, under the team's variable
    const vars = await getBlueprintVarsFile(casterToken, template!.directoryId, deployed.casterWorkspaceId);
    const lines = vars.split(/\r?\n/).filter(l => l.length > 0);
    expect(lines).toContain(`view_id = "${deployed.playerViewId}"`);
    expect(lines).toContain(`blue_cell = "${blue.id}"`);
    expect(lines).toContain(`red_cell = "${red.id}"`);
    // the mapping replaces the variable Blue Team would have had from its name
    expect(lines.some(l => l.startsWith('blue_team '))).toBe(false);

    // 2. Remove
    const remove = await removeIntegrations(token, msel.id);
    expect(remove.ok, remove.text).toBe(true);

    // expect: the MSEL is back to undeployed and the workspace is gone from Caster
    const removed = await waitForMsel(
      token,
      msel.id,
      m => !m.playerViewId && !m.casterWorkspaceId && m.status !== 'Pulling',
      480_000
    );
    expect(removed.casterRunId).toBeFalsy();
    expect(await getCasterWorkspace(casterToken, deployed.casterWorkspaceId)).toBeNull();
  });

  test('Push is refused when two teams map to the same topology team', async () => {
    const msel = await createMsel(token);
    mselId = msel.id;
    await updateMsel(token, msel.id, {
      usePlayer: true,
      useCaster: true,
      casterDirectoryId: template!.directoryId,
    });

    const blue = await createTeam(token, msel.id, { name: 'Blue Team', shortName: 'BLUE' });
    const green = await createTeam(token, msel.id, { name: 'Green Team', shortName: 'GRN' });
    for (const team of [blue, green]) {
      const r = await tryUpdateTeam(token, team.id, { casterTeamVariable: 'blue_cell' });
      expect(r.ok, r.text).toBe(true);
    }

    // 1. Push
    const push = await pushIntegrations(token, msel.id);

    // expect: 409, naming both teams and the variable they share, and nothing is deployed
    expect(push.status).toBe(409);
    // the teams are listed in database order, so check each part rather than one string
    expect(push.data?.title).toContain('"Blue Team"');
    expect(push.data?.title).toContain('"Green Team"');
    expect(push.data?.title).toContain('all become "blue_cell"');
    const after = await waitForMsel(token, msel.id, () => true);
    expect(after.status).not.toBe('Pushing');
    expect(after.playerViewId).toBeFalsy();
    expect(after.casterWorkspaceId).toBeFalsy();
  });

  test('Push is refused when the MSEL uses Caster without Player', async () => {
    const msel = await createMsel(token);
    mselId = msel.id;
    await updateMsel(token, msel.id, {
      usePlayer: false,
      useCaster: true,
      casterDirectoryId: template!.directoryId,
    });

    const push = await pushIntegrations(token, msel.id);

    expect(push.status).toBe(409);
    expect(push.data?.title).toContain('requires Player');
  });
});
