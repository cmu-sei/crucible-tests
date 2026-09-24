// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// The Competency Frameworks admin section: the framework and competency dialogs, the Scale
// column (resolved client-side from the scale list), the search filter, the expanded row's
// Work Roles / Competencies split (derived in the component from each idNumber, not stored),
// and the delete button's in-use lock. Blueprint.Api.Tests owns the endpoints' status codes,
// the persisted rows and the can-delete rule itself; this spec asserts what the page shows.

import { test, expect, Page, Locator } from '../../fixtures';
import {
  getBlueprintToken,
  gotoBlueprintAdminSection,
  tempBlueprintName,
  createMsel,
  deleteMsel,
  createCompetencyFramework,
  deleteCompetencyFramework,
  findCompetencyFrameworksByName,
  addCompetencyToMsel,
  createProficiencyScale,
  deleteProficiencyScale,
  fillDialogFields,
} from '../../test-helpers';

/** The framework's own row (not its detail row), after narrowing the list with the search box. */
async function findFrameworkRow(page: Page, name: string): Promise<Locator> {
  await page.getByPlaceholder('Search').first().fill(name);
  const row = page.locator('mat-row.element-row').filter({ hasText: name });
  await expect(row).toHaveCount(1, { timeout: 15000 });
  return row;
}

/** The trash button in a framework row. It carries a tooltip rather than a title. */
function frameworkDeleteButton(page: Page, row: Locator): Locator {
  return row
    .locator('button')
    .filter({ has: page.locator('mat-icon[fonticon="mdi-trash-can-outline"]') });
}

/** Save the open competency dialog and wait for the framework to reload. */
async function saveCompetencyDialog(page: Page, method: 'POST' | 'PUT') {
  const dialog = page.getByRole('dialog');
  const saved = page.waitForResponse(
    (r) => r.url().toLowerCase().includes('/competencies') && r.request().method() === method
  );
  const reloaded = page.waitForResponse(
    (r) => /\/api\/competencyframeworks\/[0-9a-f-]{36}$/i.test(r.url()) && r.request().method() === 'GET'
  );
  await dialog.getByRole('button', { name: 'Save' }).click();
  expect((await saved).ok()).toBe(true);
  await reloaded;
  await expect(dialog).toBeHidden();
}

test.describe('Admin - Competencies and Proficiency', () => {
  let frameworkName: string;
  let scaleId: string | undefined;
  let mselId: string | undefined;

  test.beforeEach(() => {
    frameworkName = tempBlueprintName('Framework');
    scaleId = undefined;
    mselId = undefined;
  });

  test.afterEach(async () => {
    const token = await getBlueprintToken();
    // The MSEL's pool pins the framework, so it goes first.
    if (mselId) await deleteMsel(token, mselId);
    for (const fw of await findCompetencyFrameworksByName(token, frameworkName)) {
      await deleteCompetencyFramework(token, fw.id);
    }
    if (scaleId) await deleteProficiencyScale(token, scaleId);
  });

  test('Create, edit, populate and delete a competency framework', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();
    const scale = await createProficiencyScale(token, { name: tempBlueprintName('FwScale') });
    scaleId = scale.id;

    await gotoBlueprintAdminSection(page, 'Competencies');

    // 1. Create a framework. Save stays disabled until it has a name; the scale picker lists
    //    the seeded scale.
    await page.getByTitle('Add new competency framework').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Create Competency Framework')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
    await fillDialogFields([
      [dialog.getByLabel('Name', { exact: true }), frameworkName],
      [dialog.getByLabel('Version', { exact: true }), '1.0'],
      [dialog.getByLabel('Source', { exact: true }), 'SPEC'],
      [dialog.getByLabel('Description', { exact: true }), 'Framework lifecycle spec'],
    ]);
    await dialog.getByRole('combobox', { name: 'Proficiency Scale' }).click();
    await page.getByRole('option', { name: scale.name, exact: true }).click();

    const created = page.waitForResponse(
      (r) => r.url().toLowerCase().endsWith('/api/competencyframeworks') && r.request().method() === 'POST'
    );
    await dialog.getByRole('button', { name: 'Save' }).click();
    expect((await created).ok()).toBe(true);
    await expect(dialog).toBeHidden();

    // 2. The row shows each field, with the scale resolved to its name.
    const row = await findFrameworkRow(page, frameworkName);
    await expect(row.locator('mat-cell.column-version')).toHaveText('1.0');
    await expect(row.locator('mat-cell.column-source')).toHaveText('SPEC');
    await expect(row.locator('mat-cell.column-scale')).toHaveText(scale.name);
    await expect(row.locator('mat-cell.column-description')).toHaveText('Framework lifecycle spec');

    // 3. A search that matches nothing empties the table.
    await page.getByPlaceholder('Search').first().fill(`${frameworkName}-no-such-framework`);
    await expect(page.getByText('No Competency Frameworks found')).toBeVisible();
    await findFrameworkRow(page, frameworkName);

    // 4. Edit: the dialog opens pre-filled and the row picks up the change.
    await row.getByTitle(`Edit ${frameworkName}`).click();
    await expect(dialog.getByText('Edit Competency Framework')).toBeVisible();
    await expect(dialog.getByLabel('Version', { exact: true })).toHaveValue('1.0');
    await fillDialogFields([[dialog.getByLabel('Version', { exact: true }), '2.0']]);
    const updated = page.waitForResponse(
      (r) => r.url().toLowerCase().includes('/api/competencyframeworks/') && r.request().method() === 'PUT'
    );
    await dialog.getByRole('button', { name: 'Save' }).click();
    expect((await updated).ok()).toBe(true);
    await expect(dialog).toBeHidden();
    await expect(row.locator('mat-cell.column-version')).toHaveText('2.0');

    // 5. Expand the row. A new framework has no work roles and no competencies.
    await row.click();
    const detail = page.locator('mat-row.detail-row').filter({ has: page.locator('.section-panel') });
    // Each panel is found by its header's accessible name: the header's raw text has line
    // breaks between the label and its count.
    const workRolesName = /^Work Roles \(/;
    const competenciesName = /^Competencies \(/;
    const workRolesHeader = detail.getByRole('button', { name: workRolesName });
    const competenciesHeader = detail.getByRole('button', { name: competenciesName });
    const workRolesPanel = detail
      .locator('mat-expansion-panel')
      .filter({ has: page.getByRole('button', { name: workRolesName }) });
    const competenciesPanel = detail
      .locator('mat-expansion-panel')
      .filter({ has: page.getByRole('button', { name: competenciesName }) });
    await expect(competenciesHeader).toContainText('Competencies (0)');

    // 6. Add a competency. Picking a Type seeds the ID Number with that type's prefix, and
    //    Save stays disabled until there is an ID Number or Short Name.
    await competenciesHeader.click();
    await competenciesPanel.getByTitle('Add competency').click();
    await expect(dialog.getByText('Add Competency')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
    await dialog.getByRole('combobox', { name: 'Type' }).click();
    await page.getByRole('option', { name: 'Knowledge', exact: true }).click();
    const idNumber = dialog.getByLabel('ID Number', { exact: true });
    await expect(idNumber).toHaveValue('K');
    await expect(dialog.getByRole('button', { name: 'Save' })).toBeEnabled();
    await fillDialogFields([
      [idNumber, 'K0901'],
      [dialog.getByLabel('Short Name', { exact: true }), 'Spec knowledge'],
    ]);
    await saveCompetencyDialog(page, 'POST');

    await expect(competenciesHeader).toContainText('Competencies (1)');
    const knowledgeRow = competenciesPanel.locator('mat-row.comp-row').filter({ hasText: 'K0901' });
    await expect(knowledgeRow.locator('mat-cell.comp-col-type')).toHaveText('Knowledge');
    await expect(knowledgeRow.locator('mat-cell.comp-col-name')).toHaveText('Spec knowledge');

    // 7. Add a work role from its own panel: the Type is locked to Work Role, the ID is seeded
    //    with "WRL-", and the result lands in Work Roles, not Competencies.
    await workRolesHeader.click();
    await workRolesPanel.getByTitle('Add work role').click();
    await expect(dialog.getByText('Add Work Role')).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'Type' })).toHaveAttribute('aria-disabled', 'true');
    await expect(idNumber).toHaveValue('WRL-');
    await fillDialogFields([
      [idNumber, 'WRL-901'],
      [dialog.getByLabel('Short Name', { exact: true }), 'Spec work role'],
    ]);
    await saveCompetencyDialog(page, 'POST');

    await expect(workRolesPanel.locator('mat-row.comp-row').filter({ hasText: 'WRL-901' })).toHaveCount(1);
    await expect(competenciesHeader).toContainText('Competencies (1)');
    await expect(competenciesPanel.locator('mat-row.comp-row').filter({ hasText: 'WRL-901' })).toHaveCount(0);

    // 8. Delete the competency. The confirm names it; No keeps it, Yes removes it.
    const confirm = page.getByRole('dialog').filter({ hasText: 'Delete Competency' });
    await knowledgeRow.getByTitle('Delete K0901').click();
    await expect(confirm).toContainText('Are you sure you want to delete K0901?');
    await confirm.getByRole('button', { name: 'No' }).click();
    await expect(confirm).toBeHidden();
    await expect(knowledgeRow).toHaveCount(1);

    await knowledgeRow.getByTitle('Delete K0901').click();
    const competencyDeleted = page.waitForResponse(
      (r) => r.url().toLowerCase().includes('/competencies/') && r.request().method() === 'DELETE'
    );
    await confirm.getByRole('button', { name: 'Yes' }).click();
    expect((await competencyDeleted).ok()).toBe(true);
    await expect(competenciesPanel.getByText('No competencies found')).toBeVisible();
    await expect(competenciesHeader).toContainText('Competencies (0)');

    // 9. Delete the framework. The confirm is meant to count the competencies that go with it
    //    (the work role is the one left).
    await frameworkDeleteButton(page, row).click();
    const fwConfirm = page.getByRole('dialog').filter({ hasText: 'Delete Competency Framework' });
    // Pending upstream: the count is read from the framework list, which is loaded without
    // its competencies, so it is always 0. Expect "This will delete 1 competencies." once fixed.
    await expect(fwConfirm).toContainText(
      `Are you sure that you want to delete ${frameworkName}? This will delete 0 competencies.`
    );
    const fwDeleted = page.waitForResponse(
      (r) => r.url().toLowerCase().includes('/api/competencyframeworks/') && r.request().method() === 'DELETE'
    );
    await fwConfirm.getByRole('button', { name: 'Yes' }).click();
    expect((await fwDeleted).ok()).toBe(true);
    await expect(page.locator('mat-row.element-row').filter({ hasText: frameworkName })).toHaveCount(0);
    await expect(page.getByText('No Competency Frameworks found')).toBeVisible();
  });

  test('A framework in use by a MSEL cannot be deleted', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();
    const msel = await createMsel(token, { name: tempBlueprintName('FwInUse') });
    mselId = msel.id;
    const framework = await createCompetencyFramework(token, {
      name: frameworkName,
      competencies: [{ idNumber: 'K0902', shortName: 'Pooled knowledge' }],
    });
    await addCompetencyToMsel(token, msel.id, framework.competencies['K0902'].id);

    await gotoBlueprintAdminSection(page, 'Competencies');
    let row = await findFrameworkRow(page, frameworkName);

    // 1. The delete button is disabled, and its tooltip names the MSEL holding the framework.
    await expect(frameworkDeleteButton(page, row)).toBeDisabled();
    await expect(frameworkDeleteButton(page, row)).toHaveAccessibleDescription(
      `In use by 1 MSEL(s): ${msel.name}`
    );

    // 2. Once the MSEL is gone, a fresh load unlocks it again.
    await deleteMsel(token, msel.id);
    mselId = undefined;
    await gotoBlueprintAdminSection(page, 'Competencies');
    row = await findFrameworkRow(page, frameworkName);
    await expect(frameworkDeleteButton(page, row)).toBeEnabled();
    await expect(frameworkDeleteButton(page, row)).toHaveAccessibleDescription('Delete framework');
  });
});
