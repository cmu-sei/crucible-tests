// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Create, rename and delete a unit through Admin → Units. Consolidated from create-new-unit,
// edit-unit and delete-unit, which each re-proved the API round trip with a follow-up fetch;
// that contract belongs to Blueprint.Api.Tests. What only the UI can show is that the dialog,
// the list and the confirmation drive it, so every step is asserted in the rendered table.
//
// The units table paginates at 20 rows and units are global, so rows are always found through
// the table's Search box. That box filters on (keyup), so it is typed rather than filled.

import type { Page } from '@playwright/test';
import { test, expect, Services } from '../../fixtures';
import { getBlueprintToken, deleteUnit, tempBlueprintName } from '../../test-helpers';

async function searchUnits(page: Page, term: string) {
  const search = page.getByRole('textbox', { name: 'Search' });
  await search.click();
  await search.press('ControlOrMeta+a');
  await search.press('Delete');
  await search.pressSequentially(term);
}

test.describe('Admin - Units Management', () => {
  let token: string;
  const createdIds: string[] = [];
  const names: string[] = [];

  test.beforeEach(async () => {
    token = await getBlueprintToken();
  });

  test.afterEach(async () => {
    // The UI creates the unit, so find anything this test named, in case it failed before
    // the POST response was captured.
    const r = await fetch(`${Services.Blueprint.API}/api/units`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const units = r.ok ? ((await r.json()) as Array<{ id: string; name: string }>) : [];
    const ids = new Set([...createdIds, ...units.filter((u) => names.includes(u.name)).map((u) => u.id)]);
    for (const id of ids) await deleteUnit(token, id);
  });

  test('Unit Lifecycle', async ({ blueprintAuthenticatedPage: page }) => {
    const unitName = tempBlueprintName('Unit');
    const renamed = tempBlueprintName('UnitRenamed');
    const shortName = `U${unitName.slice(-6)}`;
    names.push(unitName, renamed);

    await page.goto(`${Services.Blueprint.UI}/admin`);
    const unitsNav = page.locator('mat-list-item').filter({ hasText: 'Units' }).first();
    await expect(unitsNav).toBeVisible({ timeout: 30000 });
    await unitsNav.click();
    const addButton = page.getByRole('button', { name: /Add Unit/i });
    await expect(addButton).toBeVisible({ timeout: 15000 });

    // 1. Add a unit through the dialog.
    await addButton.click();
    const dialog = page.getByRole('dialog');
    // The inputs also carry a `value="{{…}}"` binding that resets them during the dialog's
    // first render, so wait for its last-rendered part (the description editor) before typing.
    await expect(dialog.locator('angular-editor')).toBeVisible();
    const shortNameField = dialog.getByPlaceholder('Short Name (required)');
    const newNameField = dialog.getByRole('textbox', { name: 'Name', exact: true });
    // Top to bottom, tabbing out of each: the dialog commits a field to the unit on blur.
    await newNameField.click();
    await newNameField.pressSequentially(unitName);
    await page.keyboard.press('Tab');
    await shortNameField.click();
    await shortNameField.pressSequentially(shortName);
    await page.keyboard.press('Tab');
    await expect(shortNameField).toHaveValue(shortName);
    await expect(newNameField).toHaveValue(unitName);
    const created = page.waitForResponse(
      (r) => /\/api\/units$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST'
    );
    await dialog.getByRole('button', { name: /^Save$/i }).click();
    const createdResponse = await created;
    expect(createdResponse.ok()).toBe(true);
    createdIds.push((await createdResponse.json()).id);
    await expect(dialog).toBeHidden();

    //    expect: searching finds it with both names shown.
    await searchUnits(page, unitName);
    const row = page.getByRole('row').filter({ hasText: unitName });
    await expect(row).toHaveCount(1, { timeout: 15000 });
    await expect(row).toContainText(shortName);

    // 2. Rename it.
    await page.getByRole('button', { name: `Edit ${unitName}` }).click();
    await expect(dialog.locator('angular-editor')).toBeVisible();
    const nameField = dialog.getByRole('textbox', { name: 'Name', exact: true });
    //    expect: the dialog is prefilled with the current values.
    await expect(nameField).toHaveValue(unitName);
    await nameField.fill(renamed);
    await page.keyboard.press('Tab');
    await dialog.getByRole('button', { name: /^Save$/i }).click();
    await expect(dialog).toBeHidden();

    //    expect: the list shows the new name, and the old name no longer matches anything.
    await searchUnits(page, renamed);
    const renamedRow = page.getByRole('row').filter({ hasText: renamed });
    await expect(renamedRow).toHaveCount(1, { timeout: 15000 });
    await expect(renamedRow).toContainText(shortName);
    await searchUnits(page, unitName);
    await expect(page.getByRole('row').filter({ hasText: unitName })).toHaveCount(0);

    // 3. Delete it, backing out once first.
    await searchUnits(page, renamed);
    await page.getByRole('button', { name: `Delete ${renamed}` }).click();
    const confirm = page.getByRole('dialog');
    //    expect: the confirmation names the unit.
    await expect(confirm).toContainText(`delete ${renamed}?`);
    await confirm.getByRole('button', { name: 'No', exact: true }).click();
    await expect(confirm).toBeHidden();
    await expect(renamedRow).toHaveCount(1);

    await page.getByRole('button', { name: `Delete ${renamed}` }).click();
    const deleted = page.waitForResponse(
      (r) => r.url().includes(`/api/units/${createdIds[0]}`) && r.request().method() === 'DELETE'
    );
    await confirm.getByRole('button', { name: 'Yes', exact: true }).click();
    expect((await deleted).ok()).toBe(true);
    //    expect: the row is gone.
    await expect(renamedRow).toHaveCount(0, { timeout: 15000 });

    //    expect: the deletion survives a reload.
    await page.reload();
    await expect(unitsNav).toBeVisible({ timeout: 30000 });
    await unitsNav.click();
    await expect(addButton).toBeVisible({ timeout: 15000 });
    await searchUnits(page, renamed);
    await expect(page.getByRole('row').filter({ hasText: renamed })).toHaveCount(0);
  });
});
