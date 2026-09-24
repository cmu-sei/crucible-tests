// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// The Proficiency Scales admin section: the create/edit dialogs, the expandable levels table
// and the Levels count column, which the component maintains itself (a new level is pushed
// onto the in-memory scale rather than reloaded). Blueprint.Api.Tests owns the endpoints'
// status codes and persisted rows (ProficiencyScaleEndpointTests, ProficiencyLevelEndpointTests);
// this spec only asserts what the page shows.

import { test, expect, Page, Locator } from '../../fixtures';
import {
  getBlueprintToken,
  gotoBlueprintAdminSection,
  tempBlueprintName,
  deleteProficiencyScale,
  findProficiencyScalesByName,
  fillDialogFields,
} from '../../test-helpers';

/** The scale's own row (not its detail row), after narrowing the list with the search box. */
async function findScaleRow(page: Page, name: string) {
  await page.getByPlaceholder('Search').first().fill(name);
  const row = page.locator('mat-row.element-row').filter({ hasText: name });
  await expect(row).toHaveCount(1, { timeout: 15000 });
  return row;
}

/** Fill and save the Proficiency Level dialog, waiting for the request it sends. */
async function saveLevelDialog(
  page: Page,
  method: 'POST' | 'PUT',
  fields: { name?: string; value?: string; displayOrder?: string }
) {
  const dialog = page.getByRole('dialog');
  const inputs: Array<[Locator, string]> = [];
  if (fields.name !== undefined) inputs.push([dialog.getByLabel('Name'), fields.name]);
  if (fields.value !== undefined) inputs.push([dialog.getByLabel('Value'), fields.value]);
  if (fields.displayOrder !== undefined) inputs.push([dialog.getByLabel('Display Order'), fields.displayOrder]);
  await fillDialogFields(inputs);
  const saved = page.waitForResponse(
    (r) => r.url().toLowerCase().includes('/api/proficiencylevels') && r.request().method() === method
  );
  await dialog.getByRole('button', { name: 'Save' }).click();
  expect((await saved).ok()).toBe(true);
  await expect(dialog).toBeHidden();
}

test.describe('Admin - Competencies and Proficiency', () => {
  let scaleName: string;

  test.afterEach(async () => {
    const token = await getBlueprintToken();
    for (const scale of await findProficiencyScalesByName(token, scaleName)) {
      await deleteProficiencyScale(token, scale.id);
    }
  });

  test('Create a proficiency scale and manage its levels', async ({ blueprintAuthenticatedPage: page }) => {
    scaleName = tempBlueprintName('ProfScale');

    await gotoBlueprintAdminSection(page, 'Proficiency Scales');

    // 1. The create dialog will not save a nameless scale.
    await page.getByTitle('Add proficiency scale').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Create Proficiency Scale')).toBeVisible();
    const save = dialog.getByRole('button', { name: 'Save' });
    await expect(save).toBeDisabled();

    await fillDialogFields([
      [dialog.getByLabel('Name'), scaleName],
      [dialog.getByLabel('Description'), 'Levels for the scale spec'],
    ]);
    await expect(save).toBeEnabled();
    const created = page.waitForResponse(
      (r) => r.url().toLowerCase().includes('/api/proficiencyscales') && r.request().method() === 'POST'
    );
    await save.click();
    expect((await created).ok()).toBe(true);
    await expect(dialog).toBeHidden();

    // 2. The new scale is listed with no levels.
    const row = await findScaleRow(page, scaleName);
    await expect(row.locator('mat-cell.sub-col-levels')).toHaveText('0');
    await expect(row.locator('mat-cell.sub-col-desc')).toHaveText('Levels for the scale spec');

    // 3. Expanding the row shows its (empty) levels table.
    await row.click();
    const detail = page.locator('.levels-detail').filter({ hasText: `Levels for "${scaleName}"` });
    await expect(detail).toBeVisible();
    await expect(detail.getByText('No levels defined')).toBeVisible();

    // 4. Add two levels. Each appears in the detail table and bumps the Levels column.
    await detail.getByTitle('Add level').click();
    await expect(page.getByRole('dialog').getByText('Create Proficiency Level')).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Save' })).toBeDisabled();
    await saveLevelDialog(page, 'POST', { name: 'Novice', value: '1', displayOrder: '1' });

    const levelRows = detail.locator('tr.mat-mdc-row');
    await expect(levelRows).toHaveCount(1);
    await expect(levelRows.first()).toContainText('Novice');
    await expect(detail.getByText('No levels defined')).toBeHidden();
    await expect(row.locator('mat-cell.sub-col-levels')).toHaveText('1');

    await detail.getByTitle('Add level').click();
    await saveLevelDialog(page, 'POST', { name: 'Expert', value: '3', displayOrder: '2' });
    await expect(levelRows).toHaveCount(2);
    await expect(row.locator('mat-cell.sub-col-levels')).toHaveText('2');

    // 5. Edit a level: the dialog opens pre-filled and the row shows the new name.
    await detail.getByTitle('Edit Novice').click();
    await expect(page.getByRole('dialog').getByText('Edit Proficiency Level')).toBeVisible();
    await expect(page.getByRole('dialog').getByLabel('Value')).toHaveValue('1');
    await saveLevelDialog(page, 'PUT', { name: 'Beginner' });
    await expect(detail.locator('tr.mat-mdc-row').filter({ hasText: 'Beginner' })).toHaveCount(1);
    await expect(detail.locator('tr.mat-mdc-row').filter({ hasText: 'Novice' })).toHaveCount(0);

    // 6. Deleting a level has no confirmation; the row and the count both drop.
    const levelDeleted = page.waitForResponse(
      (r) => r.url().toLowerCase().includes('/api/proficiencylevels/') && r.request().method() === 'DELETE'
    );
    await detail.getByTitle('Delete Expert').click();
    expect((await levelDeleted).ok()).toBe(true);
    await expect(detail.locator('tr.mat-mdc-row')).toHaveCount(1);
    await expect(row.locator('mat-cell.sub-col-levels')).toHaveText('1');

    // 7. Deleting the scale asks first; answering No keeps it.
    await row.getByTitle(`Delete ${scaleName}`).click();
    const confirm = page.getByRole('dialog').filter({ hasText: 'Delete Scale' });
    await expect(confirm).toContainText(`Are you sure you want to delete ${scaleName}?`);
    await confirm.getByRole('button', { name: 'No' }).click();
    await expect(confirm).toBeHidden();
    await expect(row).toBeVisible();

    await row.getByTitle(`Delete ${scaleName}`).click();
    const scaleDeleted = page.waitForResponse(
      (r) => r.url().toLowerCase().includes('/api/proficiencyscales/') && r.request().method() === 'DELETE'
    );
    await page.getByRole('dialog').filter({ hasText: 'Delete Scale' }).getByRole('button', { name: 'Yes' }).click();
    expect((await scaleDeleted).ok()).toBe(true);
    await expect(page.locator('mat-row.element-row').filter({ hasText: scaleName })).toHaveCount(0);
  });
});
