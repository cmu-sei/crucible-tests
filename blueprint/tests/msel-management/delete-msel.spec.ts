// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  tempBlueprintName,
  findMselRowByName,
} from '../../test-helpers';

/**
 * Deleting a MSEL from the /build list, including the confirm/cancel paths and the
 * template guard.
 *
 * The delete control's markup is easy to get wrong, and the previous version of this spec
 * did: it looked for `button[title*="Delete"]` inside the row, which matches nothing. In
 * `msel-list.component.html` the trash button carries **no** `title` of its own — the
 * tooltip lives on a wrapping `<span [title]="getDeleteTooltip(element)">`, because a disabled
 * button fires no hover events. The button does now carry that same text as an `aria-label`
 * (added for the screen-reader spec), but it is still located here by its
 * `mdi-trash-can-outline` icon, which is stable regardless of why delete is disabled. The
 * row's titled buttons are "Download <name>" and "Copy <name>".
 *
 * Delete is disabled when: the app isn't ready, the user lacks manage permission, the MSEL
 * status is `Deployed`, or the MSEL `isTemplate`. The template case is asserted here.
 *
 * The confirm dialog is Angular Material's, reached via `getByRole('dialog')`; it renders
 * "Are you sure that you want to delete <name>?" with NO / YES buttons (see
 * `msel-list.component.ts` `delete()`).
 */
test.describe('MSEL Management', () => {
  let token: string;
  let mselId: string;
  let templateMselId: string;
  let mselName: string;
  let templateMselName: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    mselName = tempBlueprintName('TestBP-Delete');
    templateMselName = tempBlueprintName('TestBP-DeleteTemplate');

    const created = await createMsel(token, {
      name: mselName,
      description: 'Test MSEL for deletion',
      isTemplate: false,
    });
    mselId = created.id;

    const template = await createMsel(token, {
      name: templateMselName,
      description: 'Template MSEL — delete must be disabled',
      isTemplate: true,
    });
    templateMselId = template.id;
  });

  test.afterEach(async () => {
    // The non-template MSEL is deleted through the UI as part of the test; deleting again
    // is a no-op (deleteMsel swallows 404), which keeps cleanup correct if the test failed
    // before reaching the delete.
    for (const [label, id] of [
      ['MSEL', mselId],
      ['template MSEL', templateMselId],
    ] as Array<[string, string]>) {
      try {
        if (id) await deleteMsel(token, id);
      } catch (err) {
        console.warn(`Cleanup failed for ${label} ${id}: ${err}`);
      }
    }
  });

  test('Delete MSEL', async ({ blueprintAuthenticatedPage: page }) => {
    await page.goto(`${Services.Blueprint.UI}/build`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 15000 });

    // findMselRowByName types into the Search box first, so the row is on page 1 despite
    // the ~19 pre-existing MSELs and pagination.
    const mselRow = await findMselRowByName(page, mselName);
    await expect(mselRow).toBeVisible();

    // The trash button has no title/aria-label — identify it by its icon.
    const deleteButton = mselRow.locator('button:has(mat-icon[fontIcon="mdi-trash-can-outline"])');
    await expect(deleteButton).toBeVisible();
    await expect(deleteButton).toBeEnabled();

    // --- Cancel path: the MSEL must survive ---
    await deleteButton.click();

    const confirmDialog = page.getByRole('dialog').first();
    await expect(confirmDialog).toBeVisible({ timeout: 10000 });
    await expect(confirmDialog.getByText(new RegExp(`delete ${mselName}`))).toBeVisible();

    await confirmDialog.getByRole('button', { name: /^NO$/i }).click();
    await expect(confirmDialog).not.toBeVisible({ timeout: 10000 });

    // Still present in the UI...
    await expect(mselRow).toBeVisible();
    // ...and still present server-side, which is the assertion that actually matters.
    const afterCancel = await fetch(`${Services.Blueprint.API}/api/msels/${mselId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(afterCancel.status).toBe(200);

    // --- Confirm path ---
    await deleteButton.click();
    await expect(confirmDialog).toBeVisible({ timeout: 10000 });

    // Pair the confirm click with the DELETE it triggers, so the write is known-complete.
    const deleteResponse = page.waitForResponse(
      (r) => r.url().includes(`/api/msels/${mselId}`) && r.request().method() === 'DELETE',
      { timeout: 15000 }
    );
    await confirmDialog.getByRole('button', { name: /^YES$/i }).click();
    expect((await deleteResponse).status()).toBe(204);

    await expect(confirmDialog).not.toBeVisible({ timeout: 10000 });

    // Gone server-side. Blueprint currently answers 500 rather than 404 for a nonexistent
    // MSEL id, so both are accepted here — that keeps this spec focused on the delete
    // behaviour it is actually testing. Tighten to exactly 404 once the API returns it; the
    // assertion below proves the record is really gone either way.
    const afterDelete = await fetch(`${Services.Blueprint.API}/api/msels/${mselId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(
      [404, 500],
      `GET on a deleted MSEL returned ${afterDelete.status}; expected 404 (or 500 while the ` +
        `nonexistent-id defect is open)`
    ).toContain(afterDelete.status);
    // Independent of status code: the MSEL must no longer be in the list payload.
    const remaining = (await (
      await fetch(`${Services.Blueprint.API}/api/msels`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).json()) as Array<{ id: string }>;
    expect(remaining.map((m) => m.id)).not.toContain(mselId);

    // Gone from the list too — search is still filtered to this name, so the row must go.
    await expect(page.getByRole('row').filter({ hasText: mselName })).toHaveCount(0, {
      timeout: 15000,
    });

    // --- Template guard: delete must be disabled for a template MSEL ---
    const templateRow = await findMselRowByName(page, templateMselName);
    await expect(templateRow).toBeVisible();

    const templateDeleteButton = templateRow.locator(
      'button:has(mat-icon[fontIcon="mdi-trash-can-outline"])'
    );
    await expect(templateDeleteButton).toBeDisabled();

    // The tooltip explaining why lives on the wrapping span, not the button.
    await expect(
      templateRow.locator('span[title="Cannot delete template MSELs"]')
    ).toHaveCount(1);
  });
});
