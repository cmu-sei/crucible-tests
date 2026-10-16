// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  seedMselDataFields,
  createOptionListDataField,
  createRenderableScenarioEvent,
  navigateToMselSection,
  findScenarioEventRow,
  tempBlueprintName,
} from '../../test-helpers';

const SCORE_FIELD = 'Severity Score';

test.describe('Scenario Events Management', () => {
  let token: string;
  let mselId: string;

  test.beforeEach(async () => {
    // Seed: a MSEL with the standard fields plus a Double field chosen from a list.
    // The extra field goes in before the event, so the event gets a DataValue for it.
    token = await getBlueprintToken();
    mselId = (await createMsel(token)).id;
    await seedMselDataFields(token, mselId);
    await createOptionListDataField(
      token,
      mselId,
      SCORE_FIELD,
      ['1.5', '2.5'].map((v) => ({ optionName: v, optionValue: v })),
      { dataType: 'Double', displayOrder: 14 }
    );
  });

  test.afterEach(async () => {
    // Deleting the MSEL cascades to its events and data fields.
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('A Double field chosen from a list shows only the list', async ({ blueprintAuthenticatedPage: page }) => {
    const description = tempBlueprintName('TestBP-DoubleList');
    await createRenderableScenarioEvent(token, mselId, description);

    // 1. Open the event's Edit dialog
    await navigateToMselSection(page, mselId, 'Scenario Events');
    const eventRow = await findScenarioEventRow(page, description);
    await eventRow.getByRole('button', { name: /Action List/i }).click();
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog').filter({ hasText: 'Edit Event' });
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // expect: The field is a dropdown only, with no free-text number input beside it
    const select = dialog.getByRole('combobox', { name: SCORE_FIELD });
    await expect(select).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: SCORE_FIELD })).toHaveCount(0);

    // expect: The dropdown offers the field's options (in either order, since the list
    // is not sorted by displayOrder)
    await select.click();
    await expect(page.getByRole('option')).toHaveCount(2);
    await expect(page.getByRole('option', { name: '1.5' })).toBeVisible();
    await expect(page.getByRole('option', { name: '2.5' })).toBeVisible();
    await page.keyboard.press('Escape');
  });
});
