// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: blueprint/blueprint-test-plan.md

import { Page, Locator } from '@playwright/test';
import { test, expect, selectMatSelectOption } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createDataField,
  createRenderableScenarioEvent,
  navigateToMselSection,
  findScenarioEventRow,
  listMselDataFields,
  tempBlueprintName,
} from '../../test-helpers';

/**
 * The MSEL Data Fields section and its Add/Edit Data Field dialog.
 *
 * `DataFieldEndpointTests` owns the API side (status codes, persisted rows, cascades). What
 * only a browser can show is the dialog's own behaviour — its client-side validation, the
 * option-list controls that switch on and off with the Data Type — and that a field saved
 * through it is actually *consumed*: it becomes a column of the Scenario Events grid and an
 * input in the scenario event editor.
 *
 * Every field name is a `tempBlueprintName()`, so a row or column header can only belong to
 * this test. Deleting the MSEL in teardown cascades to its data fields and events.
 */

/** The Data Fields grid row for a field, matched by its (unique) name cell. */
function dataFieldRow(page: Page, name: string): Locator {
  return page.getByRole('row').filter({ has: page.getByRole('cell', { name, exact: true }) });
}

/** Open the Add a Data Field dialog through the header's "+" menu. */
async function openNewDataFieldDialog(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Add data Field' }).click();
  await page.getByRole('menuitem', { name: 'New Data Field' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a Data Field' });
  await expect(dialog).toBeVisible({ timeout: 10000 });
  return dialog;
}

async function chooseDataType(page: Page, dialog: Locator, dataType: string): Promise<void> {
  await selectMatSelectOption(
    page,
    dialog.getByRole('combobox', { name: 'Data Type' }),
    page.getByRole('option', { name: dataType, exact: true })
  );
  await expect(dialog.getByRole('combobox', { name: 'Data Type' })).toContainText(dataType);
}

/** Open a scenario event's Edit Event dialog from its row's Action List menu. */
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
    // Seeds the standard 13 data fields plus one event to open in the editor.
    eventText = tempBlueprintName('TestBP-DataFieldEvent');
    await createRenderableScenarioEvent(token, mselId, eventText, { deltaSeconds: 300 });
  });

  test.afterEach(async () => {
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Add a data field through the dialog, and it becomes an event column and editor input', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const fieldName = tempBlueprintName('TestBP-NewField');

    await navigateToMselSection(page, mselId, 'Data Fields');
    await expect(dataFieldRow(page, 'Control Number')).toBeVisible({ timeout: 15000 });

    // The four system-defined rows are listed but carry no Edit/Delete actions.
    for (const systemField of ['Move', 'Group', 'Execution Time', 'Integration Target']) {
      const row = page
        .getByRole('row')
        .filter({ hasText: '*System Defined*' })
        .filter({ has: page.getByRole('cell', { name: systemField, exact: true }) });
      await expect(row).toBeVisible();
      await expect(row.getByRole('button', { name: /^(Edit|Delete) / })).toHaveCount(0);
    }

    const dialog = await openNewDataFieldDialog(page);
    const save = dialog.getByRole('button', { name: 'Save' });
    const displayOrder = dialog.getByRole('textbox', { name: 'Display Order' });
    const name = dialog.getByRole('textbox', { name: 'Name' });

    // Display Order defaults to one past the 13 seeded fields; the new-field defaults are
    // to show on the events list, the exercise view and the editor's Default tab.
    await expect(displayOrder).toHaveValue('14');
    await expect(dialog.getByRole('checkbox', { name: 'Display on the Events list' })).toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: 'Display on the Exercise View' })).toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: 'Display on "Default" edit tab' })).toBeChecked();

    // Validation: a name is required, and the display order must be a positive number.
    await expect(save).toBeDisabled();
    await name.fill(fieldName);
    await expect(save).toBeEnabled();
    await displayOrder.fill('0');
    await expect(save).toBeDisabled();
    await displayOrder.fill('');
    await expect(save).toBeDisabled();
    await displayOrder.fill('14');
    await expect(save).toBeEnabled();

    await chooseDataType(page, dialog, 'Integer');

    const created = page.waitForResponse(
      (r) => /\/api\/datafields$/i.test(new URL(r.url()).pathname) && r.request().method() === 'POST'
    );
    await save.click();
    expect((await created).ok()).toBe(true);
    await expect(dialog).toBeHidden();

    // The grid shows the new field with its order and type, with no reload.
    const row = dataFieldRow(page, fieldName);
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row.getByRole('cell').nth(1)).toContainText('14');
    await expect(row.getByRole('cell', { name: 'Integer', exact: true })).toBeVisible();

    // Consumed: the field is a column of the Scenario Events grid...
    await page.locator('mat-list-item').filter({ hasText: 'Scenario Events' }).first().click();
    await expect(page.getByRole('columnheader', { name: fieldName, exact: true })).toBeVisible({
      timeout: 15000,
    });

    // ...and a free-text input (Integer, no option list) on the editor's Default tab.
    const editor = await openEditEventDialog(page, eventText);
    await expect(editor.getByRole('tab', { name: 'Default' })).toHaveAttribute('aria-selected', 'true');
    await expect(editor.getByRole('textbox', { name: fieldName, exact: true })).toBeVisible();
    await editor.getByRole('button', { name: 'Cancel' }).click();
    await expect(editor).toBeHidden();
  });

  test('Edit a data field, then delete it after declining the first confirmation', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const originalName = tempBlueprintName('TestBP-EditField');
    const renamed = tempBlueprintName('TestBP-RenamedField');
    await createDataField(token, mselId, {
      name: originalName,
      dataType: 'String',
      displayOrder: 14,
      onScenarioEventList: true,
    });

    await navigateToMselSection(page, mselId, 'Data Fields');
    const row = dataFieldRow(page, originalName);
    await expect(row).toBeVisible({ timeout: 15000 });

    // Edit: the dialog is retitled and prefilled from the row.
    await row.getByRole('button', { name: `Edit ${originalName}` }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit Data Field' });
    await expect(dialog).toBeVisible();
    const name = dialog.getByRole('textbox', { name: 'Name' });
    await expect(name).toHaveValue(originalName);
    await expect(dialog.getByRole('combobox', { name: 'Data Type' })).toContainText('String');

    // Clearing the name disables Save; a rename re-enables it.
    await name.fill('');
    await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
    await name.fill(renamed);

    const updated = page.waitForResponse(
      (r) => /\/api\/datafields\/[^/]+$/i.test(new URL(r.url()).pathname) && r.request().method() === 'PUT'
    );
    await dialog.getByRole('button', { name: 'Save' }).click();
    expect((await updated).ok()).toBe(true);
    await expect(dialog).toBeHidden();

    const renamedRow = dataFieldRow(page, renamed);
    await expect(renamedRow).toBeVisible({ timeout: 10000 });
    await expect(dataFieldRow(page, originalName)).toHaveCount(0);

    // Declining the confirmation leaves the field in place.
    await renamedRow.getByRole('button', { name: `Delete ${renamed}` }).click();
    let confirm = page.getByRole('dialog', { name: 'Delete Data Field' });
    await expect(confirm).toContainText(`Are you sure that you want to delete ${renamed}?`);
    await confirm.getByRole('button', { name: 'No' }).click();
    await expect(confirm).toBeHidden();
    await expect(renamedRow).toBeVisible();

    // Confirming removes it from the grid.
    await renamedRow.getByRole('button', { name: `Delete ${renamed}` }).click();
    confirm = page.getByRole('dialog', { name: 'Delete Data Field' });
    const deleted = page.waitForResponse(
      (r) => /\/api\/datafields\/[^/]+$/i.test(new URL(r.url()).pathname) && r.request().method() === 'DELETE'
    );
    await confirm.getByRole('button', { name: 'Yes' }).click();
    expect((await deleted).ok()).toBe(true);
    await expect(renamedRow).toHaveCount(0, { timeout: 10000 });

    // Consumed: the deleted field is no longer a Scenario Events column.
    await page.locator('mat-list-item').filter({ hasText: 'Scenario Events' }).first().click();
    await expect(await findScenarioEventRow(page, eventText)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('columnheader', { name: 'Control Number', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: renamed, exact: true })).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: originalName, exact: true })).toHaveCount(0);
  });

  test('The Data Type drives the option-list controls', async ({ blueprintAuthenticatedPage: page }) => {
    await navigateToMselSection(page, mselId, 'Data Fields');
    await expect(dataFieldRow(page, 'Control Number')).toBeVisible({ timeout: 15000 });

    const dialog = await openNewDataFieldDialog(page);
    await dialog.getByRole('textbox', { name: 'Name' }).fill(tempBlueprintName('TestBP-TypeField'));

    const useOptionList = dialog.getByRole('checkbox', { name: 'Use Option List' });
    const multiSelect = dialog.getByRole('checkbox', { name: 'Multi-select' });
    const optionsLink = dialog.getByTitle('Click to manage options');
    const save = dialog.getByRole('button', { name: 'Save' });

    // A type that cannot carry an option list keeps the checkbox disabled.
    for (const dataType of ['DateTime', 'Boolean', 'Html']) {
      await chooseDataType(page, dialog, dataType);
      await expect(useOptionList, `${dataType} cannot use an option list`).toBeDisabled();
    }

    // String can: checking it reveals the Multi-select checkbox and the options link.
    await chooseDataType(page, dialog, 'String');
    await expect(useOptionList).toBeEnabled();
    await expect(multiSelect).toHaveCount(0);
    await useOptionList.check();
    await expect(multiSelect).toBeEnabled();
    await expect(multiSelect).not.toBeChecked();
    await expect(optionsLink).toHaveText('0 options');
    await expect(save).toBeEnabled();

    // Switching to a type that disallows lists disables both controls and hides the link.
    await chooseDataType(page, dialog, 'DateTime');
    await expect(useOptionList).toBeDisabled();
    await expect(multiSelect).toBeDisabled();
    await expect(optionsLink).toHaveCount(0);

    // Competency forces an option list, multi-select and the facilitation flag, locks the
    // first two, and cannot be saved until at least one competency is chosen.
    await chooseDataType(page, dialog, 'Competency');
    await expect(useOptionList).toBeChecked();
    await expect(useOptionList).toBeDisabled();
    await expect(multiSelect).toBeChecked();
    await expect(multiSelect).toBeDisabled();
    await expect(dialog.getByRole('checkbox', { name: 'Facilitation Data Field' })).toBeChecked();
    await expect(optionsLink).toHaveText('Manage');
    await expect(save).toBeDisabled();

    // Cancel discards the draft: nothing is added to the grid or the MSEL.
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('row').filter({ hasText: 'TestBP-TypeField' })).toHaveCount(0);
    expect((await listMselDataFields(token, mselId)).length).toBe(13);
  });
});
