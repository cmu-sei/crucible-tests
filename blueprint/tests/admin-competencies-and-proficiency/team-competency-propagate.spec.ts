// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Assigning MSEL teams to pooled competencies, and the "Add/Remove Team from Related"
// dialog that offers to carry the change to the competency's pooled children. Which
// children are offered (by parentId or relatedIdNumbers, and only those not already in the
// target state), the pre-selection and the live "Yes (n)" count are all client-side.
// Blueprint.Api.Tests owns the teamcompetencies endpoints; this spec asserts what the tab
// shows.

import { test, expect, Page } from '../../fixtures';
import {
  getBlueprintToken,
  tempBlueprintName,
  createMsel,
  deleteMsel,
  createTeam,
  createCompetencyFramework,
  deleteCompetencyFramework,
  addCompetencyToMsel,
  navigateToMselSection,
} from '../../test-helpers';

const TEAM = 'SPT';

function poolRow(page: Page, idNumber: string) {
  return page.locator('mat-row.pool-row').filter({
    has: page.locator('mat-cell.pool-col-id', { hasText: new RegExp(`^\\s*${idNumber}\\s*$`) }),
  });
}

function teamsCell(page: Page, idNumber: string) {
  return poolRow(page, idNumber).locator('mat-cell.pool-col-teams');
}

test.describe('MSEL Competencies', () => {
  let mselId: string | undefined;
  let frameworkId: string | undefined;

  test.afterEach(async () => {
    const token = await getBlueprintToken();
    // Teams and pool rows go with the MSEL, which must go before the framework it pins.
    if (mselId) await deleteMsel(token, mselId);
    if (frameworkId) await deleteCompetencyFramework(token, frameworkId);
    mselId = undefined;
    frameworkId = undefined;
  });

  test('Carry a team assignment to related competencies', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();
    const msel = await createMsel(token, { name: tempBlueprintName('PropagateMsel') });
    mselId = msel.id;
    await createTeam(token, msel.id, { name: tempBlueprintName('PropagateTeam'), shortName: TEAM });
    const framework = await createCompetencyFramework(token, {
      name: tempBlueprintName('PropagateFw'),
      competencies: [
        { idNumber: 'SPEC-WRL-601', shortName: 'Propagate work role' },
        { idNumber: 'T0601', shortName: 'Propagate task', parentIdNumber: 'SPEC-WRL-601' },
        { idNumber: 'K0601', shortName: 'Propagate knowledge', parentIdNumber: 'SPEC-WRL-601' },
      ],
    });
    frameworkId = framework.id;
    for (const c of Object.values(framework.competencies)) {
      await addCompetencyToMsel(token, msel.id, c.id);
    }

    await navigateToMselSection(page, msel.id, 'Competencies');
    await expect(page.locator('mat-row.pool-row')).toHaveCount(3);
    for (const id of ['SPEC-WRL-601', 'T0601', 'K0601']) {
      await expect(teamsCell(page, id)).toHaveText('—');
    }

    // 1. Expanding a pooled competency shows the MSEL's teams as available, none assigned.
    await poolRow(page, 'SPEC-WRL-601').locator('mat-cell.pool-col-id').click();
    const detail = page.locator('.related-enchilada');
    await expect(detail.getByText('Assigned (0)')).toBeVisible();
    await expect(detail.getByText('No teams assigned')).toBeVisible();

    // 2. Adding the team to the work role offers its two pooled children, both pre-selected.
    await detail.getByTitle(`Add ${TEAM}`).click();
    const addDialog = page.getByRole('dialog').filter({ hasText: 'Add Team from Related' });
    await expect(addDialog).toContainText(`Also add team ${TEAM} to the 2 related competencies on the MSEL?`);
    const offered = addDialog.locator('mat-row');
    await expect(offered).toHaveCount(2);
    await expect(offered.filter({ hasText: 'T0601' })).toContainText('Propagate task');
    await expect(offered.filter({ hasText: 'K0601' })).toContainText('Propagate knowledge');
    await expect(addDialog.getByRole('button', { name: 'Yes (2)' })).toBeEnabled();

    // 3. The submit label tracks the selection, and an empty selection cannot be submitted.
    await offered.filter({ hasText: 'K0601' }).getByRole('checkbox').uncheck();
    await expect(addDialog.getByRole('button', { name: 'Yes (1)' })).toBeEnabled();
    await offered.filter({ hasText: 'T0601' }).getByRole('checkbox').uncheck();
    await expect(addDialog.getByRole('button', { name: 'Yes (0)' })).toBeDisabled();
    await offered.filter({ hasText: 'T0601' }).getByRole('checkbox').check();
    await addDialog.getByRole('button', { name: 'Yes (1)' }).click();
    await expect(addDialog).toBeHidden();

    // 4. The work role and the one selected child carry the team; the other child does not.
    await expect(teamsCell(page, 'SPEC-WRL-601')).toHaveText(TEAM);
    await expect(teamsCell(page, 'T0601')).toHaveText(TEAM);
    await expect(teamsCell(page, 'K0601')).toHaveText('—');
    await expect(detail.getByText('Assigned (1)')).toBeVisible();
    await expect(detail.getByText('All teams assigned')).toBeVisible();

    // 5. Removing the team from the work role offers only the child that has it. Answering
    //    No removes it from the work role alone.
    await detail.getByTitle(`Remove ${TEAM}`).click();
    const removeDialog = page.getByRole('dialog').filter({ hasText: 'Remove Team from Related' });
    await expect(removeDialog).toContainText(`Also remove team ${TEAM} from the 1 related competency on the MSEL?`);
    await expect(removeDialog.locator('mat-row')).toHaveCount(1);
    await expect(removeDialog.locator('mat-row')).toContainText('T0601');
    await removeDialog.getByRole('button', { name: 'No' }).click();
    await expect(removeDialog).toBeHidden();
    await expect(teamsCell(page, 'SPEC-WRL-601')).toHaveText('—');
    await expect(teamsCell(page, 'T0601')).toHaveText(TEAM);

    // 6. A competency with no pooled children takes the team without asking.
    await poolRow(page, 'K0601').locator('mat-cell.pool-col-id').click();
    await expect(detail.getByText('Assigned (0)')).toBeVisible();
    await detail.getByTitle(`Add ${TEAM}`).click();
    await expect(teamsCell(page, 'K0601')).toHaveText(TEAM);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
