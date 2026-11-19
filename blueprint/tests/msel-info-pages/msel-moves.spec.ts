// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// A MSEL's Moves section. MoveEndpointTests owns the API; this spec covers what the move list
// computes in the browser: the next move number and start offset it pre-fills (move-list
// addOrEditMove), the warning that names moves sharing a start time or out of order, the d/h/m
// offset editor, the client-side search and the delete confirmation. Moves save in any order;
// the Info tab and the push endpoint are where the order is required.

import { test, expect, BLUEPRINT_THEMES, applyBlueprintTheme } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  blueprintCall,
  createMove,
  createScenarioEvent,
  listMselRecords,
  navigateToMselSection,
  tempBlueprintName,
} from '../../test-helpers';

for (const theme of BLUEPRINT_THEMES) {
  test.describe(`${theme} theme › MSEL - Moves`, () => {
    test('Move Lifecycle And Start Time Ordering', async ({ blueprintAuthenticatedPage: page }) => {
      await applyBlueprintTheme(page, theme);
      const token = await getBlueprintToken();
      const msel = await createMsel(token);
      const firstDescription = tempBlueprintName('MoveOne');
      const secondDescription = tempBlueprintName('MoveTwo');

      try {
        await navigateToMselSection(page, msel.id, 'Moves');
        // The move list renders before its active-MSEL subscription fires. Until then
        // `this.msel` is an empty MselPlus, so 'Add new move' posts a move with no mselId: the
        // save fails and the row never appears, yet the dialog still pre-fills Move Number 1,
        // so nothing in the dialog shows it. 'Switch to Real Time' is disabled until
        // `msel.startTime` is set, which only happens when the MSEL is bound (createMsel seeds a
        // start time), so its enabled state shows the list is ready.
        await expect(page.getByRole('button', { name: 'Switch to Real Time' })).toBeEnabled({
          timeout: 15000,
        });
        const rows = page.locator('tbody tr');
        const rowFor = (description: string) => rows.filter({ hasText: description });
        const warning = page.getByRole('status', { name: 'Move start times' });
        const dialog = page.getByRole('dialog');

        // 1. The first move defaults to number 1.
        await page.getByRole('button', { name: 'Add new move' }).click();
        await expect(dialog.getByRole('heading', { name: 'Add a Move' })).toBeVisible();
        await expect(dialog.getByLabel('Move Number')).toHaveValue('1');
        await dialog.getByLabel('Move Description').fill(firstDescription);
        await dialog.getByRole('button', { name: 'Save' }).click();
        await expect(dialog).toBeHidden();
        await expect(rowFor(firstDescription).locator('td.column-move-number')).toHaveText('1');
        await expect(warning).toBeHidden();

        // 2. The next move defaults to the next number and an hour after the latest start, so the
        //    moves are in order and nothing is flagged.
        await page.getByRole('button', { name: 'Add new move' }).click();
        await expect(dialog.getByRole('heading', { name: 'Add a Move' })).toBeVisible();
        await expect(dialog.getByLabel('Move Number')).toHaveValue('2');
        await expect(dialog.getByTitle('Hours from Start')).toHaveValue('01');
        await dialog.getByLabel('Move Description').fill(secondDescription);
        await dialog.getByRole('button', { name: 'Save' }).click();
        await expect(dialog).toBeHidden();
        await expect(rowFor(secondDescription).locator('td.column-move-number')).toHaveText('2');
        await expect(warning).toBeHidden();

        // 3. Saving is allowed however the moves are timed: moving move 2 back to the start makes it
        //    share move 1's start time, and the list names the pair.
        await page.getByRole('button', { name: 'Edit Move 2' }).click();
        await expect(dialog.getByRole('heading', { name: 'Edit Move' })).toBeVisible();
        await expect(dialog.getByLabel('Move Description')).toHaveValue(secondDescription);
        const hours = dialog.getByTitle('Hours from Start');
        await hours.fill('0');
        // The offset editor commits on the input's change event.
        await hours.press('Tab');
        await dialog.getByRole('button', { name: 'Save' }).click();
        await expect(dialog).toBeHidden();
        await expect(warning).toContainText('Move 1 and Move 2 start at the same time.');

        // 4. Moving move 2 to 30 minutes after the start clears the warning.
        await page.getByRole('button', { name: 'Edit Move 2' }).click();
        const minutes = dialog.getByTitle('Minutes from Start');
        await minutes.fill('30');
        await minutes.press('Tab');
        await dialog.getByRole('button', { name: 'Save' }).click();
        await expect(dialog).toBeHidden();
        await expect(warning).toBeHidden();

        // Secondary: the new offset was saved (the API serializes both fields as strings).
        await expect
          .poll(async () =>
            (await listMselRecords(token, msel.id, 'moves')).map((m) => [
              Number(m.moveNumber),
              Number(m.deltaSeconds),
            ])
          )
          .toEqual(expect.arrayContaining([[2, 1800]]));

        // 5. Search narrows the list by description.
        const search = page.getByPlaceholder('Search');
        await search.fill(firstDescription);
        await expect(rows).toHaveCount(1);
        await expect(rowFor(firstDescription)).toHaveCount(1);
        await page.getByRole('button', { name: 'Clear Search' }).click();
        await expect(rowFor(secondDescription)).toHaveCount(1);

        // 6. Delete move 1: declining keeps it, confirming removes only that move.
        await page.getByRole('button', { name: 'Delete Move 1' }).click();
        const confirm = page.getByRole('dialog').filter({ hasText: 'Delete Move' });
        await expect(confirm).toContainText(
          `Are you sure that you want to delete ${firstDescription}?`
        );
        await confirm.getByRole('button', { name: 'Cancel' }).click();
        await expect(confirm).toBeHidden();
        await expect(rowFor(firstDescription)).toHaveCount(1);

        await page.getByRole('button', { name: 'Delete Move 1' }).click();
        await confirm.getByRole('button', { name: 'Delete' }).click();
        await expect(rowFor(firstDescription)).toHaveCount(0);
        await expect(rowFor(secondDescription)).toHaveCount(1);
      } finally {
        // Cascades to the MSEL's moves.
        await deleteMsel(token, msel.id);
      }
    });

    test('Push Is Refused Until The Moves And Events Are In Order', async ({ blueprintAuthenticatedPage: page }) => {
      await applyBlueprintTheme(page, theme);
      const token = await getBlueprintToken();
      const msel = await createMsel(token);

      try {
        // Moves 1 and 2 share a start, and an event at -60s starts before the first move.
        await createMove(token, msel.id, { moveNumber: 1, deltaSeconds: 0 });
        await createMove(token, msel.id, { moveNumber: 2, deltaSeconds: 0 });
        await createScenarioEvent(token, msel.id, { deltaSeconds: -60 });

        // The API refuses the push and names each problem.
        const push = await blueprintCall(token, `/api/msels/${msel.id}/integrations`, { method: 'POST' });
        expect(push.status).toBe(409);
        expect(push.text).toContain('Fix the moves before pushing.');
        expect(push.text).toContain('Move 1 and Move 2 start at the same time.');
        expect(push.text).toContain('1 scenario event starts before Move 1, so it is in no move.');

        // The Info tab says the same, and the Moves tab lists the problems too.
        await navigateToMselSection(page, msel.id, 'Info');
        const info = page.getByRole('status', { name: 'Moves to fix before pushing' });
        await expect(info).toContainText('Move 1 and Move 2 start at the same time.');
        await expect(info).toContainText('1 scenario event starts before Move 1, so it is in no move.');
        await page.locator('mat-list-item').filter({ hasText: 'Moves' }).first().click();
        const moves = page.getByRole('status', { name: 'Move start times' });
        await expect(moves).toContainText('1 scenario event starts before Move 1, so it is in no move.');
      } finally {
        await deleteMsel(token, msel.id);
      }
    });
  });
}
