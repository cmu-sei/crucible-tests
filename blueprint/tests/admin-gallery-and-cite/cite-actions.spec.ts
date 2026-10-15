// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// CITE Actions, both as admin templates and on a MSEL. CiteActionEndpointTests owns the API;
// what only the browser can show is the dialog's required-description gate, the MSEL list's
// client-side Move/Team filters, and the "All Moves" x "All Teams" fan-out — the UI, not the
// API, turns one dialog submission into one POST per team per move (cite-action-list
// saveAction), so no API test can see it.

import { test, expect, selectMatSelectOption } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  updateMsel,
  createTeam,
  createMove,
  deleteBlueprintRecord,
  gotoBlueprintAdminSection,
  listMselRecords,
  listTemplates,
  navigateToMselSection,
  tempBlueprintName,
} from '../../test-helpers';

test.describe('CITE Actions', () => {
  test('CITE Action Template Lifecycle', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();
    const description = tempBlueprintName('CiteActionTpl');
    const editedDescription = tempBlueprintName('CiteActionTplEdited');

    try {
      await gotoBlueprintAdminSection(page, 'CITE Actions');

      // 1. Create. The primary button stays disabled until the description is filled in.
      await page.getByRole('button', { name: 'Add a template CITE Action' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: 'New CITE Action Template' })).toBeVisible();
      // expect: templates carry no move, team or display order.
      await expect(dialog.getByRole('combobox')).toHaveCount(0);
      await expect(dialog.getByLabel('Display Order')).toHaveCount(0);
      const save = dialog.getByRole('button', { name: 'Save' });
      await expect(save).toBeDisabled();
      await dialog.getByLabel('Description of the Action').fill(description);
      await expect(save).toBeEnabled();
      await save.click();
      await expect(dialog).toBeHidden();

      const search = page.getByPlaceholder('Search');
      await search.fill(description);
      const row = page.locator('tbody tr').filter({ hasText: description });
      await expect(row).toHaveCount(1);

      // 2. Edit.
      await page.getByRole('button', { name: `Edit ${description}` }).click();
      await expect(dialog.getByRole('heading', { name: 'Edit CITE Action Template' })).toBeVisible();
      await dialog.getByLabel('Description of the Action').fill(editedDescription);
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(dialog).toBeHidden();
      await search.fill(editedDescription);
      const editedRow = page.locator('tbody tr').filter({ hasText: editedDescription });
      await expect(editedRow).toHaveCount(1);

      // 3. Delete, through the template-specific confirmation.
      await page.getByRole('button', { name: `Delete ${editedDescription}` }).click();
      const confirm = page.getByRole('dialog').filter({ hasText: 'Delete CITE Action Template' });
      await expect(confirm).toContainText(
        `Are you sure that you want to delete ${editedDescription}?`
      );
      await confirm.getByRole('button', { name: 'Yes' }).click();
      await expect(editedRow).toHaveCount(0);
    } finally {
      for (const t of await listTemplates(token, 'citeActions')) {
        if (t.description === description || t.description === editedDescription) {
          await deleteBlueprintRecord(token, 'citeActions', t.id);
        }
      }
    }
  });

  test('New MSEL CITE Action Fans Out Across All Teams And Moves', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const token = await getBlueprintToken();
    const msel = await createMsel(token);

    try {
      await updateMsel(token, msel.id, { useCite: true });
      const teamA = await createTeam(token, msel.id, {
        name: tempBlueprintName('CiteTeamA'),
        shortName: 'CTA',
      });
      const teamB = await createTeam(token, msel.id, {
        name: tempBlueprintName('CiteTeamB'),
        shortName: 'CTB',
      });
      await createMove(token, msel.id, { moveNumber: 1 });
      await createMove(token, msel.id, { moveNumber: 2 });
      const description = tempBlueprintName('CiteActionFanOut');

      await navigateToMselSection(page, msel.id, 'CITE Actions');

      // 1. Create one action for "All Moves" and "All Teams".
      await page.getByRole('button', { name: 'Add CITE Action' }).click();
      await page.getByRole('menuitem', { name: 'New CITE Action' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: 'New CITE Action' })).toBeVisible();
      await selectMatSelectOption(
        page,
        dialog.getByRole('combobox', { name: 'Move' }),
        page.getByRole('option', { name: 'All Moves' })
      );
      await selectMatSelectOption(
        page,
        dialog.getByRole('combobox', { name: 'Team' }),
        page.getByRole('option', { name: 'All Teams' })
      );
      await dialog.getByLabel('Description of the Action').fill(description);
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(dialog).toBeHidden();

      // expect: one row per team per move — 2 x 2.
      const rows = page.locator('tbody tr').filter({ hasText: description });
      await expect(rows).toHaveCount(4);
      for (const team of [teamA, teamB]) {
        await expect(rows.filter({ hasText: `${team.shortName} - ${team.name}` })).toHaveCount(2);
      }

      // Secondary: four distinct records reached the server.
      const saved = (await listMselRecords(token, msel.id, 'citeActions')).filter(
        (a) => a.description === description
      );
      expect(new Set(saved.map((a) => `${a.teamId}/${a.moveNumber}`)).size).toBe(4);

      // 2. The list's Move and Team filters narrow the rows client-side.
      const toolbar = page.locator('.cssLayoutRowStartCenter').first();
      await selectMatSelectOption(
        page,
        toolbar.getByRole('combobox', { name: 'Move' }),
        page.getByRole('option', { name: '1', exact: true })
      );
      await expect(rows).toHaveCount(2);
      await expect(rows.locator('td.column-move')).toHaveText(['1', '1']);

      await selectMatSelectOption(
        page,
        toolbar.getByRole('combobox', { name: 'Team' }),
        page.getByRole('option', { name: teamB.shortName, exact: true })
      );
      await expect(rows).toHaveCount(1);
      await expect(rows).toContainText(teamB.name);

      // The free-text search also matches the team's short name.
      await selectMatSelectOption(
        page,
        toolbar.getByRole('combobox', { name: 'Move' }),
        page.getByRole('option', { name: 'All Moves' })
      );
      await selectMatSelectOption(
        page,
        toolbar.getByRole('combobox', { name: 'Team' }),
        page.getByRole('option', { name: 'All Teams' })
      );
      await expect(rows).toHaveCount(4);
      await page.getByPlaceholder('Search').fill(teamA.shortName);
      await expect(rows).toHaveCount(2);
      await expect(rows.filter({ hasText: teamB.name })).toHaveCount(0);

      // 3. Deleting one of the fanned-out actions removes only that row.
      await rows.first().getByRole('button', { name: `Delete ${description}` }).click();
      await page
        .getByRole('dialog')
        .filter({ hasText: 'Delete CITE Action' })
        .getByRole('button', { name: 'Yes' })
        .click();
      await expect(rows).toHaveCount(1);
    } finally {
      // Cascades to the MSEL's teams, moves and CITE actions.
      await deleteMsel(token, msel.id);
    }
  });
});
