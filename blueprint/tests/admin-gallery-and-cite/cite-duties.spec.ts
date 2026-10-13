// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// CITE Duties, both as admin templates and on a MSEL. CiteDutyEndpointTests owns the API;
// this spec covers the dialog's required-name gate, the "All Teams" fan-out (the UI posts one
// duty per MSEL team — cite-duty-list saveDuty), and the list's client-side Team filter.

import { test, expect, selectMatSelectOption } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  updateMsel,
  createTeam,
  deleteBlueprintRecord,
  gotoBlueprintAdminSection,
  listMselRecords,
  listTemplates,
  navigateToMselSection,
  tempBlueprintName,
} from '../../test-helpers';

test.describe('CITE Duties', () => {
  test('CITE Duty Template Lifecycle', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();
    const name = tempBlueprintName('CiteDutyTpl');
    const editedName = tempBlueprintName('CiteDutyTplEdited');

    try {
      await gotoBlueprintAdminSection(page, 'CITE Duties');

      // 1. Create. Save stays disabled until a name is entered.
      await page.getByRole('button', { name: 'Add a template CITE Duty' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: 'New CITE Duty Template' })).toBeVisible();
      // expect: a template is not tied to a team.
      await expect(dialog.getByRole('combobox')).toHaveCount(0);
      const save = dialog.getByRole('button', { name: 'Save' });
      await expect(save).toBeDisabled();
      await dialog.getByLabel('Name').fill(name);
      await expect(save).toBeEnabled();
      await save.click();
      await expect(dialog).toBeHidden();

      const search = page.getByPlaceholder('Search');
      await search.fill(name);
      const row = page.locator('tbody tr').filter({ hasText: name });
      await expect(row).toHaveCount(1);

      // 2. Edit. Clearing the name re-disables Save.
      await row.getByRole('button', { name: 'Edit this duty' }).click();
      await expect(dialog.getByRole('heading', { name: 'Edit CITE Duty Template' })).toBeVisible();
      await expect(dialog.getByLabel('Name')).toHaveValue(name);
      await dialog.getByLabel('Name').fill('');
      await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
      await dialog.getByLabel('Name').fill(editedName);
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(dialog).toBeHidden();
      await search.fill(editedName);
      const editedRow = page.locator('tbody tr').filter({ hasText: editedName });
      await expect(editedRow).toHaveCount(1);

      // 3. Delete, through the template-specific confirmation.
      await page.getByRole('button', { name: `Delete ${editedName}` }).click();
      const confirm = page.getByRole('dialog').filter({ hasText: 'Delete CITE Duty Template' });
      await expect(confirm).toContainText(`Are you sure that you want to delete ${editedName}?`);
      await confirm.getByRole('button', { name: 'Yes' }).click();
      await expect(editedRow).toHaveCount(0);
    } finally {
      for (const t of await listTemplates(token, 'citeDuties')) {
        if (t.name === name || t.name === editedName) {
          await deleteBlueprintRecord(token, 'citeDuties', t.id);
        }
      }
    }
  });

  test('New MSEL CITE Duty Fans Out Across All Teams', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const token = await getBlueprintToken();
    const msel = await createMsel(token);

    try {
      await updateMsel(token, msel.id, { useCite: true });
      const teamA = await createTeam(token, msel.id, {
        name: tempBlueprintName('DutyTeamA'),
        shortName: 'DTA',
      });
      const teamB = await createTeam(token, msel.id, {
        name: tempBlueprintName('DutyTeamB'),
        shortName: 'DTB',
      });
      const name = tempBlueprintName('CiteDutyFanOut');

      await navigateToMselSection(page, msel.id, 'CITE Duties');

      // 1. One submission for "All Teams".
      await page.getByRole('button', { name: 'Add CITE Duty' }).click();
      await page.getByRole('menuitem', { name: 'New CITE Duty' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: 'New CITE Duty' })).toBeVisible();
      await dialog.getByLabel('Name').fill(name);
      await selectMatSelectOption(
        page,
        dialog.getByRole('combobox', { name: 'Team' }),
        page.getByRole('option', { name: 'All Teams' })
      );
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(dialog).toBeHidden();

      // Pending upstream: the add menu's items call $event.stopPropagation(), so the menu is
      // never closed — it is still open over the list after the dialog saves, and its backdrop
      // swallows the next click. Once fixed, expect the menu to be hidden here instead.
      const addMenu = page.getByRole('menu');
      await expect(addMenu.getByRole('menuitem', { name: 'New CITE Duty' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(addMenu).toBeHidden();

      // expect: one duty row per MSEL team, each showing its team.
      const rows = page.locator('tbody tr').filter({ hasText: name });
      await expect(rows).toHaveCount(2);
      await expect(rows.filter({ hasText: `${teamA.shortName} - ${teamA.name}` })).toHaveCount(1);
      await expect(rows.filter({ hasText: `${teamB.shortName} - ${teamB.name}` })).toHaveCount(1);

      // Secondary: two records, one per team.
      const saved = (await listMselRecords(token, msel.id, 'citeDuties')).filter(
        (d) => d.name === name
      );
      expect(saved.map((d) => d.teamId).sort()).toEqual([teamA.id, teamB.id].sort());

      // 2. The Team filter narrows the list client-side.
      await selectMatSelectOption(
        page,
        page.locator('.cssLayoutRowStartCenter').first().getByRole('combobox', { name: 'Team' }),
        page.getByRole('option', { name: teamA.shortName, exact: true })
      );
      await expect(rows).toHaveCount(1);
      await expect(rows).toContainText(teamA.name);

      // 3. Editing a MSEL duty offers the MSEL's teams but no "All Teams" fan-out.
      await rows.getByRole('button', { name: 'Edit this duty' }).click();
      await expect(dialog.getByRole('heading', { name: 'Edit CITE Duty' })).toBeVisible();
      await dialog.getByRole('combobox', { name: 'Team' }).click();
      await expect(page.getByRole('option', { name: teamB.name })).toBeVisible();
      await expect(page.getByRole('option', { name: 'All Teams' })).toHaveCount(0);
      await page.keyboard.press('Escape');
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toBeHidden();

      // 4. Delete the remaining visible duty.
      await rows.getByRole('button', { name: `Delete ${name}` }).click();
      await page
        .getByRole('dialog')
        .filter({ hasText: 'Delete CITE Duty' })
        .getByRole('button', { name: 'Yes' })
        .click();
      await expect(rows).toHaveCount(0);
    } finally {
      // Cascades to the MSEL's teams and CITE duties.
      await deleteMsel(token, msel.id);
    }
  });
});
