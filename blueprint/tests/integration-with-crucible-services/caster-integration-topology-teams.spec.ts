// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: blueprint/blueprint-test-plan.md

import { test, expect } from '../../fixtures';
import { randomUUID } from 'crypto';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createTeam,
  blueprintCall,
} from '../../test-helpers';
import {
  getCasterToken,
  createCasterTemplate,
  deleteCasterTemplate,
  getCasterTeamVariables,
  tryUpdateTeam,
  CasterTemplate,
  VARIABLES_ONLY_TEMPLATE_TEAM_VARIABLES,
} from '../../caster-helpers';

test.describe('Caster Integration', () => {
  let token: string;
  let casterToken: string;
  let template: CasterTemplate | undefined;
  let mselId: string | undefined;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    casterToken = await getCasterToken();
    template = await createCasterTemplate(casterToken);
  });

  test.afterEach(async () => {
    if (mselId) await deleteMsel(token, mselId);
    await deleteCasterTemplate(casterToken, template);
    mselId = undefined;
    template = undefined;
  });

  test('Topology Teams are the template variables a team ID can go in', async () => {
    // 1. Ask Blueprint for the directory's team variables
    const r = await getCasterTeamVariables(token, template!.directoryId);

    // expect: the string and untyped variables only, required unless they have a default. The
    // Blueprint variables, a number, a sensitive variable and a variable terraform.tfvars already
    // assigns are all left out.
    expect(r.ok, r.text).toBe(true);
    expect(r.data).toEqual(VARIABLES_ONLY_TEMPLATE_TEAM_VARIABLES);
  });

  test('Topology Teams for a directory that does not exist are refused', async () => {
    const r = await getCasterTeamVariables(token, randomUUID());

    expect(r.status).toBe(403);
  });

  test('A team mapping is saved, cleared, and refused when tfvars cannot hold it', async () => {
    const msel = await createMsel(token);
    mselId = msel.id;
    const team = await createTeam(token, msel.id, { name: 'Blue Team', shortName: 'BLUE' });
    const saved = async () => (await blueprintCall<any>(token, `/api/teams/${team.id}`)).data.casterTeamVariable;

    // 1. Map the team to a topology team
    const mapped = await tryUpdateTeam(token, team.id, { casterTeamVariable: 'blue_cell' });
    expect(mapped.ok, mapped.text).toBe(true);
    expect(await saved()).toBe('blue_cell');

    // 2. A blank mapping goes back to "By team name"
    const cleared = await tryUpdateTeam(token, team.id, { casterTeamVariable: '   ' });
    expect(cleared.ok, cleared.text).toBe(true);
    expect(await saved()).toBeNull();

    // 3. Names terraform cannot read as a variable, and the variables Blueprint writes itself,
    // are refused with 409 and leave the team as it was
    for (const variable of ['not valid!', '2nd_team', 'view_id', 'user_id']) {
      const refused = await tryUpdateTeam(token, team.id, { casterTeamVariable: variable });
      expect(refused.status, `${variable}: ${refused.text}`).toBe(409);
    }
    expect(await saved()).toBeNull();
  });
});
