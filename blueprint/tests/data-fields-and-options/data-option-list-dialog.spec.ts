// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: blueprint/blueprint-test-plan.md

import { Page, Locator } from '@playwright/test';
import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createOptionListDataField,
  createRenderableScenarioEvent,
  navigateToMselSection,
  findScenarioEventRow,
  listMselDataFields,
  tempBlueprintName,
} from '../../test-helpers';

/**
 * The Manage Options dialog for an option-list data field, and the Edit Option dialog it
 * opens. It has two entry points. Inside the Edit Data Field dialog, changes stay a draft
 * until that dialog is saved. From the Data Fields grid's Options cell, each change is meant
 * to save at once, but in this build every change fails (see the `Pending upstream:` test).
 * The scenario event editor consumes the options, rendering an option-list field as a
 * drop-down of the options' IDs.
 */

const SEEDED_OPTIONS = [
  { optionName: 'OPT-B', optionValue: 'Bravo' },
  { optionName: 'OPT-A', optionValue: 'Alpha' },
  { optionName: 'OPT-C', optionValue: 'Charlie' },
];

function dataFieldRow(page: Page, name: string): Locator {
  return page.getByRole('row').filter({ has: page.getByRole('cell', { name, exact: true }) });
}

/** The Manage Options dialog, whatever count its title currently shows. */
function manageOptionsDialog(page: Page): Locator {
  return page.getByRole('dialog', { name: /^Manage Options \(\d+\)$/ });
}

/** The option rows of the Manage Options table (the header row has no cells). */
function optionRows(dialog: Locator): Locator {
  return dialog.getByRole('row').filter({ has: dialog.page().getByRole('cell') });
}

/** Assert the table lists exactly these options, in this order, as `[order, id, name]`. */
async function expectOptionRows(dialog: Locator, rows: Array<[number, string, string]>): Promise<void> {
  await expect(optionRows(dialog)).toHaveText(
    rows.map(([order, id, name]) => new RegExp(`^\\s*${order}\\s*${id}\\s*${name}\\s*$`))
  );
}

function optionRow(dialog: Locator, optionName: string): Locator {
  return optionRows(dialog).filter({ has: dialog.page().getByRole('cell', { name: optionName, exact: true }) });
}

/** Wait for the PUT that persists a data field (and with it, its option list). */
function waitForDataFieldPut(page: Page) {
  return page.waitForResponse(
    (r) => /\/api\/datafields\/[^/]+$/i.test(new URL(r.url()).pathname) && r.request().method() === 'PUT'
  );
}

async function openEditEventDialog(page: Page, eventText: string): Promise<Locator> {
  const eventRow = await findScenarioEventRow(page, eventText);
  await expect(eventRow).toBeVisible({ timeout: 15000 });
  await eventRow.getByRole('button', { name: /Action List/i }).click();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Event' });
  await expect(dialog).toBeVisible({ timeout: 10000 });
  return dialog;
}

test.describe('Data Fields and Options', () => {
  let token: string;
  let mselId: string;
  let eventText: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    mselId = (await createMsel(token)).id;
    eventText = tempBlueprintName('TestBP-OptionEvent');
    await createRenderableScenarioEvent(token, mselId, eventText, { deltaSeconds: 300 });
  });

  test.afterEach(async () => {
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Manage a field’s options in the Edit Data Field dialog, and the event editor offers the result', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const fieldName = tempBlueprintName('TestBP-ListField');
    const field = await createOptionListDataField(token, mselId, fieldName, SEEDED_OPTIONS);

    await navigateToMselSection(page, mselId, 'Data Fields');
    const row = dataFieldRow(page, fieldName);
    await expect(row).toBeVisible({ timeout: 15000 });

    // Inside the field dialog, option edits are a draft: nothing is sent until Save.
    const dataFieldPuts: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'PUT' && /\/api\/datafields\//i.test(req.url())) dataFieldPuts.push(req.url());
    });

    await row.getByRole('button', { name: `Edit ${fieldName}` }).click();
    const fieldDialog = page.getByRole('dialog', { name: 'Edit Data Field' });
    await expect(fieldDialog).toBeVisible();
    const link = fieldDialog.getByTitle('Click to manage options');
    await expect(link).toHaveText('3 options');
    await link.click();
    const dialog = manageOptionsDialog(page);
    await expect(dialog).toHaveAccessibleName('Manage Options (3)');
    await expectOptionRows(dialog, [
      [1, 'OPT-B', 'Bravo'],
      [2, 'OPT-A', 'Alpha'],
      [3, 'OPT-C', 'Charlie'],
    ]);

    // Add: the Edit Option dialog proposes the next display order, and needs an ID and a Name.
    await dialog.getByRole('button', { name: 'Add new option' }).click();
    let optionDialog = page.getByRole('dialog', { name: 'Edit Option' });
    await expect(optionDialog).toBeVisible();
    await expect(optionDialog.getByRole('textbox', { name: 'Display Order' })).toHaveValue('4');
    const optionSave = () => optionDialog.getByRole('button', { name: 'Save' });
    await expect(optionSave()).toBeDisabled();
    await optionDialog.getByRole('textbox', { name: 'ID' }).fill('OPT-D');
    await expect(optionSave()).toBeDisabled();
    await optionDialog.getByRole('textbox', { name: 'Name' }).fill('Delta');
    await expect(optionSave()).toBeEnabled();
    await optionSave().click();
    await expect(optionDialog).toBeHidden();
    await expect(dialog).toHaveAccessibleName('Manage Options (4)');
    await expect(optionRow(dialog, 'OPT-D')).toHaveText(/4\s*OPT-D\s*Delta/);

    // Edit: the dialog is prefilled from the row, and the change shows in the table.
    await optionRow(dialog, 'OPT-A').getByRole('button', { name: 'Edit this option' }).click();
    optionDialog = page.getByRole('dialog', { name: 'Edit Option' });
    await expect(optionDialog.getByRole('textbox', { name: 'ID' })).toHaveValue('OPT-A');
    const nameBox = optionDialog.getByRole('textbox', { name: 'Name' });
    await expect(nameBox).toHaveValue('Alpha');
    await nameBox.fill('');
    await expect(optionSave()).toBeDisabled();
    await nameBox.fill('Alpha Prime');
    await optionSave().click();
    await expect(optionDialog).toBeHidden();
    await expect(optionRow(dialog, 'OPT-A')).toHaveText(/2\s*OPT-A\s*Alpha Prime/);

    // Delete takes effect at once, with no confirmation step.
    await optionRow(dialog, 'OPT-C').getByRole('button', { name: 'Delete this option' }).click();
    await expect(dialog).toHaveAccessibleName('Manage Options (3)');
    await expect(optionRow(dialog, 'OPT-C')).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
    await expect(link).toHaveText('3 options');
    expect(dataFieldPuts, 'option edits must stay local until the field is saved').toEqual([]);

    const saved = waitForDataFieldPut(page);
    await fieldDialog.getByRole('button', { name: 'Save' }).click();
    expect((await saved).ok()).toBe(true);
    await expect(fieldDialog).toBeHidden();

    // Secondary: the stored option list matches what the dialog showed.
    const stored = (await listMselDataFields(token, mselId)).find((f) => f.id === field.id);
    expect(
      (stored?.dataOptions ?? []).map((o: any) => `${o.optionName}=${o.optionValue}`).sort()
    ).toEqual(['OPT-A=Alpha Prime', 'OPT-B=Bravo', 'OPT-D=Delta']);

    // Consumed: the event editor renders the field as a drop-down of the current option IDs.
    // (It lists them in stored order, which the API does not guarantee, so compare as a set.)
    await page.locator('mat-list-item').filter({ hasText: 'Scenario Events' }).first().click();
    const editor = await openEditEventDialog(page, eventText);
    const select = editor.getByRole('combobox', { name: fieldName, exact: true });
    await expect(select).toBeVisible();
    await select.click();
    const offered = page.locator('.mat-mdc-select-panel').getByRole('option');
    await expect(offered).toHaveCount(3);
    expect((await offered.allInnerTexts()).map((t) => t.trim()).sort()).toEqual(['OPT-A', 'OPT-B', 'OPT-D']);
    await page.keyboard.press('Escape');
    await expect(page.locator('.mat-mdc-select-panel')).toBeHidden();
    await editor.getByRole('button', { name: 'Cancel' }).click();
    await expect(editor).toBeHidden();
  });

  test('From the grid’s Options cell, options can be browsed but not changed', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const fieldName = tempBlueprintName('TestBP-GridListField');
    const field = await createOptionListDataField(token, mselId, fieldName, SEEDED_OPTIONS);

    await navigateToMselSection(page, mselId, 'Data Fields');
    const row = dataFieldRow(page, fieldName);
    await expect(row).toBeVisible({ timeout: 15000 });
    const optionsCell = row.getByTitle('Click to manage options');
    await expect(optionsCell).toHaveText('3 options');

    await optionsCell.click();
    const dialog = manageOptionsDialog(page);
    await expect(dialog).toHaveAccessibleName('Manage Options (3)');

    // Listed by display order by default, whatever order the API returned them in.
    await expectOptionRows(dialog, [
      [1, 'OPT-B', 'Bravo'],
      [2, 'OPT-A', 'Alpha'],
      [3, 'OPT-C', 'Charlie'],
    ]);

    // Search matches the ID or the description, case-insensitively.
    const search = dialog.getByRole('textbox', { name: 'Search options' });
    await search.fill('opt-a');
    await expectOptionRows(dialog, [[2, 'OPT-A', 'Alpha']]);
    await search.fill('CHAR');
    await expectOptionRows(dialog, [[3, 'OPT-C', 'Charlie']]);
    await dialog.getByRole('button', { name: 'Clear search' }).click();
    await expect(search).toHaveValue('');
    await expect(optionRows(dialog)).toHaveCount(3);

    // Sorting by ID reorders the rows.
    await dialog.getByRole('columnheader', { name: /^ID/ }).click();
    await expectOptionRows(dialog, [
      [2, 'OPT-A', 'Alpha'],
      [1, 'OPT-B', 'Bravo'],
      [3, 'OPT-C', 'Charlie'],
    ]);

    // Pending upstream: opened from the grid, the dialog is handed the Akita store's own
    // `dataOptions` array, and DataFieldListComponent's add/edit/delete/import handlers mutate
    // it in place (push / index-assign / splice) before calling updateDataField. The dev build
    // freezes store state, so each change throws a TypeError, the app shows an error alert, and
    // no PUT is sent. (Production builds skip the freeze and would silently mutate the store.)
    // Asserting the failure until the handlers work on a copy, as the Edit Data Field dialog
    // does; then this should assert each change is saved, like the test above.
    const dataFieldPuts: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'PUT' && /\/api\/datafields\//i.test(req.url())) dataFieldPuts.push(req.url());
    });
    const errorAlert = page.getByRole('alert').filter({ has: page.getByRole('heading', { name: 'TypeError' }) });
    // Only the error type is asserted. The message depends on the browser and on which
    // index the mutation hits: V8 says "object is not extensible", "Cannot assign to read only
    // property" or "Cannot delete property"; Firefox words each one differently again.
    const dismissError = async () => {
      await expect(errorAlert).toBeVisible();
      await errorAlert.getByRole('button', { name: 'Close' }).click();
      await expect(errorAlert).toHaveCount(0);
    };

    await dialog.getByRole('button', { name: 'Add new option' }).click();
    let optionDialog = page.getByRole('dialog', { name: 'Edit Option' });
    await optionDialog.getByRole('textbox', { name: 'ID' }).fill('OPT-D');
    await optionDialog.getByRole('textbox', { name: 'Name' }).fill('Delta');
    await optionDialog.getByRole('button', { name: 'Save' }).click();
    await dismissError();
    // The throw also skips the handler's close(), so the Edit Option dialog stays open.
    await optionDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(optionDialog).toBeHidden();

    await optionRow(dialog, 'OPT-A').getByRole('button', { name: 'Edit this option' }).click();
    optionDialog = page.getByRole('dialog', { name: 'Edit Option' });
    await optionDialog.getByRole('textbox', { name: 'Name' }).fill('Alpha Prime');
    await optionDialog.getByRole('button', { name: 'Save' }).click();
    await dismissError();
    await optionDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(optionDialog).toBeHidden();

    await optionRow(dialog, 'OPT-C').getByRole('button', { name: 'Delete this option' }).click();
    await dismissError();

    // Import previews fine (see data-option-import-dialog.spec.ts), but applying it fails too.
    // The icon button has no accessible name, which is also pending upstream.
    await dialog.locator('button:has(mat-icon[fonticon="mdi-upload"])').click();
    const importDialog = page.getByRole('dialog', { name: 'Import Options' });
    await importDialog.locator('input[type="file"]').setInputFiles({
      name: 'options.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('id,name\nOPT-E,Echo\n', 'utf8'),
    });
    await importDialog.getByRole('button', { name: 'Import 1 Option', exact: true }).click();
    await dismissError();
    await expect(importDialog).toBeHidden();

    await expect(dialog).toHaveAccessibleName('Manage Options (3)');
    await expectOptionRows(dialog, [
      [2, 'OPT-A', 'Alpha'],
      [1, 'OPT-B', 'Bravo'],
      [3, 'OPT-C', 'Charlie'],
    ]);
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
    await expect(optionsCell).toHaveText('3 options');
    expect(dataFieldPuts).toEqual([]);
    const stored = (await listMselDataFields(token, mselId)).find((f) => f.id === field.id);
    expect(
      (stored?.dataOptions ?? []).map((o: any) => `${o.optionName}=${o.optionValue}`).sort()
    ).toEqual(['OPT-A=Alpha', 'OPT-B=Bravo', 'OPT-C=Charlie']);
  });

  test('Option changes made inside the Edit Data Field dialog are discarded by Cancel', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const fieldName = tempBlueprintName('TestBP-DraftListField');
    await createOptionListDataField(token, mselId, fieldName, SEEDED_OPTIONS);

    await navigateToMselSection(page, mselId, 'Data Fields');
    const row = dataFieldRow(page, fieldName);
    await expect(row).toBeVisible({ timeout: 15000 });

    // Any PUT from here on would mean the draft leaked out of the dialog.
    const dataFieldPuts: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'PUT' && /\/api\/datafields\//i.test(req.url())) dataFieldPuts.push(req.url());
    });

    await row.getByRole('button', { name: `Edit ${fieldName}` }).click();
    const fieldDialog = page.getByRole('dialog', { name: 'Edit Data Field' });
    await expect(fieldDialog).toBeVisible();
    const link = fieldDialog.getByTitle('Click to manage options');
    await expect(link).toHaveText('3 options');

    await link.click();
    const list = manageOptionsDialog(page);
    await expect(list).toHaveAccessibleName('Manage Options (3)');
    await optionRow(list, 'OPT-C').getByRole('button', { name: 'Delete this option' }).click();
    await expect(list).toHaveAccessibleName('Manage Options (2)');
    await list.getByRole('button', { name: 'Close' }).click();
    await expect(list).toBeHidden();
    await expect(link).toHaveText('2 options');

    await fieldDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(fieldDialog).toBeHidden();

    // The grid, the reopened list and the stored field all still have three options.
    const optionsCell = row.getByTitle('Click to manage options');
    await expect(optionsCell).toHaveText('3 options');
    await optionsCell.click();
    const reopened = manageOptionsDialog(page);
    await expect(reopened).toHaveAccessibleName('Manage Options (3)');
    await expect(optionRow(reopened, 'OPT-C')).toHaveCount(1);
    await reopened.getByRole('button', { name: 'Close' }).click();
    await expect(reopened).toBeHidden();

    expect(dataFieldPuts).toEqual([]);
    const stored = (await listMselDataFields(token, mselId)).find((f) => f.name === fieldName);
    expect(stored?.dataOptions ?? []).toHaveLength(3);
  });

  test('Numeric option-list fields render as a drop-down in the event editor', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const integerField = tempBlueprintName('TestBP-IntListField');
    const doubleField = tempBlueprintName('TestBP-DblListField');
    await createOptionListDataField(
      token,
      mselId,
      integerField,
      [
        { optionName: 'Low', optionValue: '1' },
        { optionName: 'High', optionValue: '2' },
      ],
      { dataType: 'Integer', displayOrder: 100 }
    );
    await createOptionListDataField(
      token,
      mselId,
      doubleField,
      [
        { optionName: 'Half', optionValue: '0.5' },
        { optionName: 'Whole', optionValue: '1.0' },
      ],
      { dataType: 'Double', displayOrder: 101 }
    );

    await navigateToMselSection(page, mselId, 'Scenario Events');
    const editor = await openEditEventDialog(page, eventText);

    // Integer: a drop-down and nothing else.
    await expect(editor.getByRole('combobox', { name: integerField, exact: true })).toBeVisible();
    await expect(editor.getByRole('textbox', { name: integerField, exact: true })).toHaveCount(0);

    // Double: the drop-down is rendered...
    await expect(editor.getByRole('combobox', { name: doubleField, exact: true })).toBeVisible();
    // Pending upstream: data-value.component.html guards the numeric input with
    // `!isChosenFromList && dataType === Integer || dataType === Double`. Without parentheses
    // the `|| Double` escapes the option-list check, so a Double option-list field also
    // renders a free-text input bound to the same value. Asserting the stray input until the
    // guard is parenthesised; this should then expect a count of 0, as for Integer above.
    await expect(editor.getByRole('textbox', { name: doubleField, exact: true })).toHaveCount(1);

    await editor.getByRole('button', { name: 'Cancel' }).click();
    await expect(editor).toBeHidden();
  });
});
