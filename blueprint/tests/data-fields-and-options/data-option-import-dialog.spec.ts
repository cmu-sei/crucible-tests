// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: blueprint/blueprint-test-plan.md

import { Page, Locator } from '@playwright/test';
import { test, expect, selectMatSelectOption } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createOptionListDataField,
  navigateToMselSection,
  listMselDataFields,
  tempBlueprintName,
} from '../../test-helpers';

/**
 * The Import Options dialog. The chosen file is parsed server-side
 * (POST /api/datafields/{id}/options/preview), which also flags rows whose ID already
 * exists on the field; the dialog previews the rows, lets the user pick which to import,
 * and hands the selection back to whichever dialog opened it.
 */

function dataFieldRow(page: Page, name: string): Locator {
  return page.getByRole('row').filter({ has: page.getByRole('cell', { name, exact: true }) });
}

function manageOptionsDialog(page: Page): Locator {
  return page.getByRole('dialog', { name: /^Manage Options \(\d+\)$/ });
}

function optionRows(dialog: Locator): Locator {
  return dialog.getByRole('row').filter({ has: dialog.page().getByRole('cell') });
}

/**
 * The Manage Options dialog's import button.
 *
 * Pending upstream: the button is an icon with only a `matTooltip`, so it has no accessible
 * name and cannot be reached by role and name. Located by its icon until the button gets an
 * `aria-label`/`title`, at which point this should be `getByRole('button', { name: ... })`.
 */
function importButton(list: Locator): Locator {
  return list.locator('button:has(mat-icon[fonticon="mdi-upload"])');
}

function csv(text: string, name = 'options.csv') {
  return { name, mimeType: 'text/csv', buffer: Buffer.from(text, 'utf8') };
}

function waitForPreview(page: Page) {
  return page.waitForResponse(
    (r) =>
      /\/api\/datafields\/[^/]+\/options\/preview$/i.test(new URL(r.url()).pathname) &&
      r.request().method() === 'POST'
  );
}

/** Open the Import Options dialog from a field's Options cell in the Data Fields grid. */
async function openImportFromGrid(page: Page, fieldName: string): Promise<{ list: Locator; dialog: Locator }> {
  const row = dataFieldRow(page, fieldName);
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.getByTitle('Click to manage options').click();
  const list = manageOptionsDialog(page);
  await expect(list).toBeVisible();
  await importButton(list).click();
  const dialog = page.getByRole('dialog', { name: 'Import Options' });
  await expect(dialog).toBeVisible();
  return { list, dialog };
}

/**
 * Open the Import Options dialog through a saved field's Edit Data Field dialog, the entry
 * point whose import actually takes effect (see `data-option-list-dialog.spec.ts` for the
 * grid entry point, which fails to apply any change).
 */
async function openImportFromFieldDialog(
  page: Page,
  fieldName: string
): Promise<{ fieldDialog: Locator; list: Locator; dialog: Locator }> {
  const row = dataFieldRow(page, fieldName);
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.getByRole('button', { name: `Edit ${fieldName}` }).click();
  const fieldDialog = page.getByRole('dialog', { name: 'Edit Data Field' });
  await expect(fieldDialog).toBeVisible();
  await fieldDialog.getByTitle('Click to manage options').click();
  const list = manageOptionsDialog(page);
  await expect(list).toBeVisible();
  await importButton(list).click();
  const dialog = page.getByRole('dialog', { name: 'Import Options' });
  await expect(dialog).toBeVisible();
  return { fieldDialog, list, dialog };
}

test.describe('Data Fields and Options', () => {
  let token: string;
  let mselId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    mselId = (await createMsel(token)).id;
  });

  test.afterEach(async () => {
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Import options from a CSV: existing IDs are skipped and the selection is what gets imported', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const fieldName = tempBlueprintName('TestBP-ImportField');
    const field = await createOptionListDataField(token, mselId, fieldName, [
      { optionName: 'OPT-A', optionValue: 'Alpha' },
    ]);

    await navigateToMselSection(page, mselId, 'Data Fields');
    const { fieldDialog, list, dialog } = await openImportFromFieldDialog(page, fieldName);
    await expect(list).toHaveAccessibleName('Manage Options (1)');
    await expect(importButton(list)).toHaveAccessibleName('');

    // Before a file is chosen: instructions, a file chooser, and nothing to import.
    await expect(dialog).toContainText('Supported formats: JSON, CSV, or XLSX');
    await expect(dialog.getByRole('button', { name: 'Choose File' })).toBeEnabled();
    await expect(dialog.getByRole('heading', { name: /^Preview/ })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Import 0 Options' })).toBeDisabled();

    // The ID match against existing options is case-insensitive, so "opt-a" is a duplicate.
    const preview = waitForPreview(page);
    await dialog
      .locator('input[type="file"]')
      .setInputFiles(csv('id,name\nopt-a,Alpha again\nOPT-B,Bravo\nOPT-C,Charlie\n'));
    expect((await preview).ok()).toBe(true);

    await expect(dialog).toContainText('options.csv');
    await expect(dialog.getByRole('heading', { name: 'Preview (2 to import, 1 to skip)' })).toBeVisible();
    const previewRow = (id: string) =>
      dialog.getByRole('row').filter({ has: page.getByRole('cell', { name: id, exact: true }) });
    const rowBox = (id: string) => previewRow(id).getByRole('checkbox');
    const allBox = dialog.getByRole('columnheader').getByRole('checkbox');

    await expect(rowBox('opt-a')).toBeDisabled();
    await expect(rowBox('opt-a')).not.toBeChecked();
    await expect(rowBox('OPT-B')).toBeChecked();
    await expect(rowBox('OPT-C')).toBeChecked();
    await expect(allBox).toBeChecked();
    await expect(dialog.getByRole('button', { name: 'Import 2 Options' })).toBeEnabled();

    // Deselecting one row updates the counts, and the header box goes indeterminate.
    await rowBox('OPT-C').uncheck();
    await expect(dialog.getByRole('heading', { name: 'Preview (1 to import, 2 to skip)' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Import 1 Option', exact: true })).toBeEnabled();
    await expect(allBox).toBeChecked({ indeterminate: true });

    // From indeterminate the header box selects every importable row; clicked again it clears
    // them. The duplicate is never selected either way.
    await allBox.click();
    await expect(rowBox('OPT-C')).toBeChecked();
    await expect(dialog.getByRole('button', { name: 'Import 2 Options' })).toBeEnabled();
    await allBox.click();
    await expect(rowBox('OPT-B')).not.toBeChecked();
    await expect(rowBox('OPT-C')).not.toBeChecked();
    await expect(dialog.getByRole('button', { name: 'Import 0 Options' })).toBeDisabled();
    await allBox.click();
    await expect(dialog.getByRole('button', { name: 'Import 2 Options' })).toBeEnabled();
    await expect(rowBox('opt-a')).not.toBeChecked();

    await dialog.getByRole('button', { name: 'Import 2 Options' }).click();
    await expect(dialog).toBeHidden();

    // The imported rows are appended after the existing option; the existing one is untouched.
    await expect(list).toHaveAccessibleName('Manage Options (3)');
    await expect(optionRows(list)).toHaveText([
      /^\s*1\s*OPT-A\s*Alpha\s*$/,
      /^\s*2\s*OPT-B\s*Bravo\s*$/,
      /^\s*3\s*OPT-C\s*Charlie\s*$/,
    ]);
    await list.getByRole('button', { name: 'Close' }).click();
    await expect(list).toBeHidden();
    await expect(fieldDialog.getByTitle('Click to manage options')).toHaveText('3 options');

    // The import joins the field's draft, which Save persists.
    const saved = page.waitForResponse(
      (r) => /\/api\/datafields\/[^/]+$/i.test(new URL(r.url()).pathname) && r.request().method() === 'PUT'
    );
    await fieldDialog.getByRole('button', { name: 'Save' }).click();
    expect((await saved).ok()).toBe(true);
    await expect(fieldDialog).toBeHidden();
    await expect(dataFieldRow(page, fieldName).getByTitle('Click to manage options')).toHaveText('3 options');

    // Secondary: the stored list matches.
    const stored = (await listMselDataFields(token, mselId)).find((f) => f.id === field.id);
    expect(
      (stored?.dataOptions ?? []).map((o: any) => `${o.optionName}=${o.optionValue}`).sort()
    ).toEqual(['OPT-A=Alpha', 'OPT-B=Bravo', 'OPT-C=Charlie']);
  });

  test('A file with no data rows shows the parse error, and a valid file then replaces it', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const fieldName = tempBlueprintName('TestBP-BadImportField');
    await createOptionListDataField(token, mselId, fieldName, [{ optionName: 'OPT-A', optionValue: 'Alpha' }]);

    await navigateToMselSection(page, mselId, 'Data Fields');
    const { list, dialog } = await openImportFromGrid(page, fieldName);
    const fileInput = dialog.locator('input[type="file"]');

    let preview = waitForPreview(page);
    await fileInput.setInputFiles(csv('id,name\n', 'header-only.csv'));
    await preview;
    await expect(dialog).toContainText('header-only.csv');
    await expect(dialog.locator('mat-error')).toHaveText(
      /CSV file must have a header row and at least one data row\./
    );
    await expect(dialog.getByRole('heading', { name: /^Preview/ })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Import 0 Options' })).toBeDisabled();

    // Choosing another file clears the error and previews the new one.
    preview = waitForPreview(page);
    await fileInput.setInputFiles(csv('name,id\nDelta,OPT-D\n', 'reordered.csv'));
    expect((await preview).ok()).toBe(true);
    await expect(dialog.locator('mat-error')).toHaveCount(0);
    await expect(dialog.getByRole('heading', { name: 'Preview (1 to import, 0 to skip)' })).toBeVisible();
    // Columns are matched by header, not position.
    await expect(
      dialog.getByRole('row').filter({ has: page.getByRole('cell', { name: 'OPT-D', exact: true }) })
    ).toContainText('Delta');

    // Cancel imports nothing.
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(list).toHaveAccessibleName('Manage Options (1)');
    await expect(optionRows(list)).toHaveCount(1);
    await list.getByRole('button', { name: 'Close' }).click();
    expect((await listMselDataFields(token, mselId)).find((f) => f.name === fieldName)?.dataOptions).toHaveLength(1);
  });

  test('Importing into a new, unsaved field saves the field first', async ({ blueprintAuthenticatedPage: page }) => {
    const fieldName = tempBlueprintName('TestBP-NewImportField');

    await navigateToMselSection(page, mselId, 'Data Fields');
    const addButton = page.getByRole('button', { name: 'Add data Field' });
    await expect(addButton).toBeVisible({ timeout: 15000 });
    await addButton.click();
    await page.getByRole('menuitem', { name: 'New Data Field' }).click();
    const fieldDialog = page.getByRole('dialog', { name: 'Add a Data Field' });
    await expect(fieldDialog).toBeVisible();
    await fieldDialog.getByRole('textbox', { name: 'Name' }).fill(fieldName);
    await selectMatSelectOption(
      page,
      fieldDialog.getByRole('combobox', { name: 'Data Type' }),
      page.getByRole('option', { name: 'String', exact: true })
    );
    await fieldDialog.getByRole('checkbox', { name: 'Use Option List' }).check();
    await fieldDialog.getByTitle('Click to manage options').click();
    const list = manageOptionsDialog(page);
    await expect(list).toHaveAccessibleName('Manage Options (0)');

    // The import needs a field id to preview against, so the draft is created first.
    const created = page.waitForResponse(
      (r) => /\/api\/datafields$/i.test(new URL(r.url()).pathname) && r.request().method() === 'POST'
    );
    await importButton(list).click();
    expect((await created).ok()).toBe(true);
    const importDialog = page.getByRole('dialog', { name: 'Import Options' });
    await expect(importDialog).toBeVisible();
    // (The grid behind the modal is aria-hidden, so confirm the draft was created via the API.)
    expect((await listMselDataFields(token, mselId)).filter((f) => f.name === fieldName)).toHaveLength(1);

    const preview = waitForPreview(page);
    await importDialog.locator('input[type="file"]').setInputFiles(csv('id,name\nOPT-X,X-ray\nOPT-Y,Yankee\n'));
    expect((await preview).ok()).toBe(true);
    await importDialog.getByRole('button', { name: 'Import 2 Options' }).click();
    await expect(importDialog).toBeHidden();

    // Inside the field dialog the import is only a draft, shown in the list and the link...
    await expect(list).toHaveAccessibleName('Manage Options (2)');
    await list.getByRole('button', { name: 'Close' }).click();
    await expect(list).toBeHidden();
    await expect(fieldDialog.getByTitle('Click to manage options')).toHaveText('2 options');

    // ...until Save persists it.
    const updated = page.waitForResponse(
      (r) => /\/api\/datafields\/[^/]+$/i.test(new URL(r.url()).pathname) && r.request().method() === 'PUT'
    );
    await fieldDialog.getByRole('button', { name: 'Save' }).click();
    expect((await updated).ok()).toBe(true);
    await expect(fieldDialog).toBeHidden();
    await expect(dataFieldRow(page, fieldName)).toHaveCount(1);
    await expect(dataFieldRow(page, fieldName).getByTitle('Click to manage options')).toHaveText('2 options');

    const stored = (await listMselDataFields(token, mselId)).find((f) => f.name === fieldName);
    expect((stored?.dataOptions ?? []).map((o: any) => o.optionName).sort()).toEqual(['OPT-X', 'OPT-Y']);
  });
});
