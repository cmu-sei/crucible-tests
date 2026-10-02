// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// A MSEL's Moves section. MoveEndpointTests owns the API; this spec covers what the move list
// computes in the browser: the next move number and start offset it pre-fills (move-list
// addOrEditMove), the out-of-order start-time warning (badMoveTimeOrder), the d/h/m offset
// editor, the client-side search and the delete confirmation.

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  listMselRecords,
  navigateToMselSection,
  tempBlueprintName,
} from '../../test-helpers';

test.describe('MSEL - Moves', () => {
  test('Move Lifecycle And Start Time Ordering', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();
    const msel = await createMsel(token);
    const firstDescription = tempBlueprintName('MoveOne');
    const secondDescription = tempBlueprintName('MoveTwo');

    try {
      await navigateToMselSection(page, msel.id, 'Moves');
      const rows = page.locator('tbody tr');
      const rowFor = (description: string) => rows.filter({ hasText: description });
      const warning = page.getByText('** The moves are not in ascending start time order!');
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

      // 2. The next move defaults to the next number and to the latest existing start offset,
      //    so two moves now share a start time and the list flags the ordering.
      await page.getByRole('button', { name: 'Add new move' }).click();
      await expect(dialog.getByRole('heading', { name: 'Add a Move' })).toBeVisible();
      await expect(dialog.getByLabel('Move Number')).toHaveValue('2');
      await dialog.getByLabel('Move Description').fill(secondDescription);
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(dialog).toBeHidden();
      await expect(rowFor(secondDescription).locator('td.column-move-number')).toHaveText('2');
      await expect(warning).toBeVisible();

      // 3. Moving move 2's start 30 minutes later clears the warning.
      await page.getByRole('button', { name: 'Edit Move 2' }).click();
      await expect(dialog.getByRole('heading', { name: 'Edit Move' })).toBeVisible();
      await expect(dialog.getByLabel('Move Description')).toHaveValue(secondDescription);
      const minutes = dialog.getByTitle('Minutes from Start');
      await minutes.fill('30');
      // The offset editor commits on the input's change event.
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

      // 4. Search narrows the list by description.
      const search = page.getByPlaceholder('Search');
      await search.fill(firstDescription);
      await expect(rows).toHaveCount(1);
      await expect(rowFor(firstDescription)).toHaveCount(1);
      await page.getByRole('button', { name: 'Clear Search' }).click();
      await expect(rowFor(secondDescription)).toHaveCount(1);

      // 5. Delete move 1: declining keeps it, confirming removes only that move.
      await page.getByRole('button', { name: 'Delete Move 1' }).click();
      const confirm = page.getByRole('dialog').filter({ hasText: 'Delete Move' });
      await expect(confirm).toContainText(
        `Are you sure that you want to delete ${firstDescription}?`
      );
      await confirm.getByRole('button', { name: 'No' }).click();
      await expect(confirm).toBeHidden();
      await expect(rowFor(firstDescription)).toHaveCount(1);

      await page.getByRole('button', { name: 'Delete Move 1' }).click();
      await confirm.getByRole('button', { name: 'Yes' }).click();
      await expect(rowFor(firstDescription)).toHaveCount(0);
      await expect(rowFor(secondDescription)).toHaveCount(1);
    } finally {
      // Cascades to the MSEL's moves.
      await deleteMsel(token, msel.id);
    }
  });
});
