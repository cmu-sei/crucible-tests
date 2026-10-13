// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: blueprint/blueprint-test-plan.md

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  updateMsel,
  getMsel,
  createTeam,
  blueprintCall,
  navigateToMsel,
  navigateToMselSection,
} from '../../test-helpers';
import {
  getCasterToken,
  createCasterTemplate,
  deleteCasterTemplate,
  tryUpdateTeam,
  CasterTemplate,
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
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
    await deleteCasterTemplate(casterToken, template);
    mselId = undefined;
    template = undefined;
  });

  test('The Config tab holds Push until Caster has Player and a directory', async ({ blueprintAuthenticatedPage: page }) => {
    const msel = await createMsel(token);
    mselId = msel.id;
    await updateMsel(token, msel.id, { usePlayer: false, useCaster: true });

    // 1. Open the MSEL's Config tab
    await navigateToMsel(page, msel.id);
    const casterRow = page.locator('.integration-row').filter({
      has: page.locator('mat-checkbox').filter({ hasText: /^\s*Caster\s*$/ }),
    });
    await expect(casterRow.locator('input[type="checkbox"]')).toBeChecked({ timeout: 10000 });

    // expect: Caster without Player is called out, and Push is disabled
    const push = page.getByRole('button', { name: 'Push Integrations' });
    await expect(
      page.getByText('Caster requires Player: the VMs are added to the Player view and its teams.')
    ).toBeVisible();
    await expect(push).toBeDisabled();

    // 2. Turn on Player
    await updateMsel(token, msel.id, { usePlayer: true });
    await page.reload({ waitUntil: 'domcontentloaded' });

    // expect: the directory is what is missing now
    await expect(page.getByText('Select the Caster directory to deploy.')).toBeVisible({ timeout: 15000 });
    await expect(push).toBeDisabled();

    // 3. Choose the seeded template's directory and save
    const directories = await blueprintCall<any[]>(token, '/api/caster/directories');
    expect(directories.ok, directories.text).toBe(true);
    const directory = directories.data.find(d => d.id === template!.directoryId);
    expect(directory, 'the seeded directory is offered').toBeTruthy();
    await casterRow.locator('mat-select').click();
    await page.getByRole('option', { name: `${directory.projectName} / ${directory.name}` }).click();
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // expect: the directory is saved, the Caster warnings are gone and Push is enabled. Nothing
    // in Player opens the VM UI yet, which is pointed out without blocking Push.
    await expect.poll(async () => (await getMsel(token, msel.id)).casterDirectoryId).toBe(template!.directoryId);
    await expect(page.getByText('Select the Caster directory to deploy.')).toBeHidden();
    await expect(page.getByText(/^No Player application opens the VM UI/)).toBeVisible();
    await expect(push).toBeEnabled();
  });

  test('The Teams tab shows the topology team each team deploys to', async ({ blueprintAuthenticatedPage: page }) => {
    const msel = await createMsel(token);
    mselId = msel.id;
    await updateMsel(token, msel.id, {
      usePlayer: true,
      useCaster: true,
      casterDirectoryId: template!.directoryId,
    });
    // Blue Team is mapped; Red Cell takes red_cell by name; Green Team's name is not in the
    // template; Gold Team is mapped to a variable the template has since dropped.
    const blue = await createTeam(token, msel.id, { name: 'Blue Team', shortName: 'BLUE' });
    await createTeam(token, msel.id, { name: 'Red Cell', shortName: 'RED' });
    const green = await createTeam(token, msel.id, { name: 'Green Team', shortName: 'GRN' });
    const gold = await createTeam(token, msel.id, { name: 'Gold Team', shortName: 'GOLD' });
    for (const [team, variable] of [[blue, 'blue_cell'], [gold, 'retired_cell']] as const) {
      const r = await tryUpdateTeam(token, team.id, { casterTeamVariable: variable });
      expect(r.ok, r.text).toBe(true);
    }

    // 1. Open the Teams section
    await navigateToMselSection(page, msel.id, 'Teams');
    const row = (name: string) => page.getByRole('row').filter({ hasText: name });

    // expect: a Topology Team column with each team's variable
    await expect(page.getByRole('columnheader', { name: 'Topology Team' })).toBeVisible({ timeout: 15000 });
    await expect(row('Blue Team')).toContainText('blue_cell');
    await expect(row('Red Cell')).toContainText('red_cell');
    await expect(row('Green Team')).toContainText('green_team (not in template)');
    await expect(row('Gold Team')).toContainText('retired_cell');
    // spare_cell has no team either, but the template gives it a default
    await expect(page.getByText(/^Topology team "spare_cell"/)).toHaveCount(0);
    await expect(
      page.getByText('Gold Team is mapped to topology team "retired_cell", which the Caster template no longer declares.')
    ).toBeVisible();

    // 2. Put Blue Team back on its name
    await page.getByRole('button', { name: 'Edit Blue Team' }).click();
    let dialog = page.getByRole('dialog').first();
    await dialog.getByRole('combobox', { name: 'Topology Team' }).click();
    // expect: each option names the other teams already deploying to it
    await expect(page.getByRole('option', { name: 'red_cell (used by Red Cell)', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: 'spare_cell', exact: true })).toBeVisible();
    await page.getByRole('option', { name: 'By team name' }).click();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();

    // expect: the mapping is cleared and blue_cell, which has no default, has no team to deploy to
    await expect.poll(async () => (await blueprintCall<any>(token, `/api/teams/${blue.id}`)).data.casterTeamVariable).toBeNull();
    await expect(row('Blue Team')).toContainText('blue_team (not in template)');
    await expect(
      page.getByText('Topology team "blue_cell" has no MSEL team. The Caster template gives it no default, so the plan will fail unless Caster supplies it.')
    ).toBeVisible();

    // 3. Map Green Team to blue_cell
    await page.getByRole('button', { name: 'Edit Green Team' }).click();
    dialog = page.getByRole('dialog').first();
    await dialog.getByRole('combobox', { name: 'Topology Team' }).click();
    await page.getByRole('option', { name: 'blue_cell' }).click();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();

    // expect: Green Team deploys to blue_cell and every topology team has a team again
    await expect.poll(async () => (await blueprintCall<any>(token, `/api/teams/${green.id}`)).data.casterTeamVariable).toBe('blue_cell');
    await expect(row('Green Team')).toContainText('blue_cell');
    await expect(page.getByText(/^Topology team "blue_cell" has no MSEL team/)).toBeHidden();

    // 4. Map Gold Team to blue_cell too
    await page.getByRole('button', { name: 'Edit Gold Team' }).click();
    dialog = page.getByRole('dialog').first();
    await dialog.getByRole('combobox', { name: 'Topology Team' }).click();
    await page.getByRole('option', { name: 'blue_cell (used by Green Team)', exact: true }).click();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();

    // expect: both teams would write blue_cell, which Push refuses
    await expect.poll(async () => (await blueprintCall<any>(token, `/api/teams/${gold.id}`)).data.casterTeamVariable).toBe('blue_cell');
    // the teams are listed in load order, so match either
    await expect(
      page.getByText(/^("Green Team" and "Gold Team"|"Gold Team" and "Green Team") all become "blue_cell", so Push will be refused\./)
    ).toBeVisible();
  });
});
