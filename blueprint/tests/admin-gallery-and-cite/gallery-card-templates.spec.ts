// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Admin → Gallery Cards manages card *templates* (cards with no MSEL). CardEndpointTests in
// Blueprint.Api.Tests owns the status codes and persisted rows; this spec covers what only the
// browser shows: the add/edit dialog, the client-side search, the unsaved-work guard, and the
// delete confirmation.

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  gotoBlueprintAdminSection,
  tempBlueprintName,
  listTemplates,
  deleteBlueprintRecord,
} from '../../test-helpers';

test.describe('Admin - Gallery Cards', () => {
  test('Gallery Card Template Lifecycle', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();
    const name = tempBlueprintName('CardTpl');
    const description = tempBlueprintName('CardTplDesc');
    const editedDescription = tempBlueprintName('CardTplEdited');

    try {
      await gotoBlueprintAdminSection(page, 'Gallery Cards');

      // 1. Add a template card through the dialog.
      await page.getByRole('button', { name: 'Add a template card' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: 'Add Card' })).toBeVisible();
      // expect: a template has no MSEL, so the dialog offers no Move picker.
      await expect(dialog.getByLabel('Move')).toHaveCount(0);
      await dialog.getByLabel('Name').fill(name);
      await dialog.getByLabel('Card Description').fill(description);
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(dialog).toBeHidden();

      // expect: the new template is listed. The list's search matches the description only
      // (card-list getFilteredCards), so search by that to collapse the paginated list.
      const search = page.getByPlaceholder('Search');
      await search.fill(description);
      const row = page.locator('tbody tr').filter({ hasText: name });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText(description);

      // 2. The dialog guards unsaved work: Escape does not dismiss it, and Cancel discards
      //    the edit rather than writing it into the row.
      await page.getByRole('button', { name: `Edit ${name}` }).click();
      await expect(dialog.getByRole('heading', { name: 'Edit Card' })).toBeVisible();
      await expect(dialog.getByLabel('Name')).toHaveValue(name);
      await dialog.getByLabel('Card Description').fill('discarded edit');
      await page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toBeHidden();
      await expect(row).toContainText(description);

      // 3. Edit for real.
      await page.getByRole('button', { name: `Edit ${name}` }).click();
      await dialog.getByLabel('Card Description').fill(editedDescription);
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(dialog).toBeHidden();

      // expect: the row re-renders with the new description — and drops out of a search for
      // the old one, since the filter is re-applied to the refreshed store.
      await expect(row).toHaveCount(0);
      await search.fill(editedDescription);
      await expect(row).toHaveCount(1);
      await expect(row).toContainText(editedDescription);

      // 4. Delete: declining the confirmation keeps the row.
      await page.getByRole('button', { name: `Delete ${name}` }).click();
      const confirm = page.getByRole('dialog').filter({ hasText: 'Delete Card' });
      await expect(confirm).toContainText(`Are you sure that you want to delete ${name}?`);
      await confirm.getByRole('button', { name: 'No' }).click();
      await expect(confirm).toBeHidden();
      await expect(row).toHaveCount(1);

      // Confirming removes it.
      await page.getByRole('button', { name: `Delete ${name}` }).click();
      await confirm.getByRole('button', { name: 'Yes' }).click();
      await expect(row).toHaveCount(0);

      // Secondary: the delete reached the server.
      expect((await listTemplates(token, 'cards')).some((c) => c.name === name)).toBe(false);
    } finally {
      // The template is created through the UI, so its id is only known from the API.
      for (const t of (await listTemplates(token, 'cards')).filter((c) => c.name === name)) {
        await deleteBlueprintRecord(token, 'cards', t.id);
      }
    }
  });
});
