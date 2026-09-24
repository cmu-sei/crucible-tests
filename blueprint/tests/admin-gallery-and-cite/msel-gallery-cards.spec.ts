// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// A MSEL's own Gallery Cards section. CardEndpointTests / CardTeamEndpointTests own the API
// side; this spec covers the browser-only parts: the section appearing only when the MSEL
// uses Gallery, building a card from a template through the add menu, the Move picker fed by
// the MSEL's moves, and the expandable card-team assignment panel.

import { test, expect, selectMatSelectOption } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  updateMsel,
  createTeam,
  createMove,
  createCardTemplate,
  deleteBlueprintRecord,
  listMselRecords,
  navigateToMsel,
  navigateToMselSection,
  tempBlueprintName,
} from '../../test-helpers';

test.describe('MSEL - Gallery Cards', () => {
  let token: string;
  let mselId: string | undefined;
  let templateId: string | undefined;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
  });

  test.afterEach(async () => {
    // The MSEL delete cascades to its moves, teams, cards and card teams.
    if (mselId) await deleteMsel(token, mselId);
    if (templateId) await deleteBlueprintRecord(token, 'cards', templateId);
    mselId = undefined;
    templateId = undefined;
  });

  test('Gallery Cards Section Follows The Gallery Integration Flag', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    mselId = (await createMsel(token)).id;

    // expect: with Gallery off, the MSEL offers no Gallery Cards section.
    await navigateToMsel(page, mselId);
    const galleryItem = page.locator('mat-list-item').filter({ hasText: 'Gallery Cards' });
    await expect(page.locator('mat-list-item').filter({ hasText: 'Moves' })).toBeVisible();
    await expect(galleryItem).toHaveCount(0);

    // expect: once the MSEL uses Gallery, the section is listed.
    await updateMsel(token, mselId, { useGallery: true });
    await navigateToMsel(page, mselId);
    await expect(galleryItem).toBeVisible();
  });

  test('Add A Card From A Template And Assign Teams', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const msel = await createMsel(token);
    mselId = msel.id;
    await updateMsel(token, mselId, { useGallery: true });
    const team = await createTeam(token, mselId, {
      name: tempBlueprintName('CardTeam'),
      shortName: 'CTM',
    });
    await createMove(token, mselId, { moveNumber: 1 });
    await createMove(token, mselId, { moveNumber: 2 });
    const templateName = tempBlueprintName('CardFromTpl');
    const templateDescription = tempBlueprintName('CardFromTplDesc');
    templateId = (await createCardTemplate(token, templateName, templateDescription)).id;

    await navigateToMselSection(page, mselId, 'Gallery Cards');

    // 1. The add menu lists "New Card" plus every template; choosing a template pre-fills
    //    the dialog with the template's name and description.
    await page.getByRole('button', { name: 'Add card' }).click();
    await expect(page.getByRole('menuitem', { name: 'New Card' })).toBeVisible();
    await page.getByRole('menuitem', { name: templateName }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Add Card' })).toBeVisible();
    await expect(dialog.getByLabel('Name')).toHaveValue(templateName);
    await expect(dialog.getByLabel('Card Description')).toHaveValue(templateDescription);

    // expect: a MSEL card, unlike a template, has a Move picker listing the MSEL's moves.
    await selectMatSelectOption(
      page,
      dialog.getByRole('combobox', { name: 'Move' }),
      page.getByRole('option', { name: '2', exact: true })
    );
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();

    // expect: the MSEL list shows the new card, with the chosen move in the Move column.
    const row = page.locator('tbody tr.element-row').filter({ hasText: templateName });
    await expect(row).toHaveCount(1);
    await expect(row.locator('td.column-move')).toHaveText('2');

    // Secondary: it was saved as a MSEL card, not as another template.
    const cards = await listMselRecords(token, mselId, 'cards');
    expect(cards.map((c) => c.name)).toEqual([templateName]);

    // 2. Clicking the row expands the card-team panel.
    await row.click();
    await expect(page.getByText('Select the MSEL teams that will see this card')).toBeVisible();
    const cardTeams = page.locator('mat-table.mat-table-card-teams');
    const mselTeams = page.locator('mat-table.mat-table-msel-teams');
    await expect(cardTeams.locator('mat-row')).toHaveCount(0);

    // Adding the team moves it from the MSEL-teams list into the Card Teams table.
    await mselTeams.getByRole('button', { name: `Add ${team.name}` }).click();
    const cardTeamRow = cardTeams.locator('mat-row').filter({ hasText: 'CTM' });
    await expect(cardTeamRow).toHaveCount(1);
    await expect(page.getByText('No teams found')).toBeVisible();

    // The Is Shown / Can Post checkboxes are editable per team.
    const isShown = cardTeamRow.getByRole('checkbox').first();
    const wasShown = await isShown.isChecked();
    await isShown.click();
    await expect(isShown).toBeChecked({ checked: !wasShown });

    // Removing the team puts it back in the MSEL-teams list.
    await cardTeamRow.getByRole('button').click();
    await expect(cardTeams.locator('mat-row')).toHaveCount(0);
    await expect(mselTeams.getByRole('button', { name: `Add ${team.name}` })).toBeVisible();

    // 3. Deleting the card, after confirming, removes the row.
    await page.getByRole('button', { name: `Delete ${templateName}` }).click();
    const confirm = page.getByRole('dialog').filter({ hasText: 'Delete Card' });
    await confirm.getByRole('button', { name: 'Yes' }).click();
    await expect(row).toHaveCount(0);

    // expect: the template itself is untouched by deleting a card built from it.
    await page.getByRole('button', { name: 'Add card' }).click();
    await expect(page.getByRole('menuitem', { name: templateName })).toBeVisible();
    await page.keyboard.press('Escape');
  });
});
