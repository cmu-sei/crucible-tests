// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  getMsel,
  tempBlueprintName,
  navigateToMsel,
} from '../../test-helpers';

/**
 * Marking a MSEL as a template, and having the Templates filter pick it up.
 *
 * This spec was previously test.fixme()'d on the theory that "the checkbox update isn't
 * saved to the backend". That was wrong on both counts, and the real cause is worth
 * recording because it applies to every field on the Config tab:
 *
 *   The Config tab is an explicit-save form. Editing a control only sets the component's
 *   `isChanged` flag — it issues no request. Nothing persists until the **Save Changes**
 *   icon button (disabled until `isChanged`) is clicked, which is what fires the PUT.
 *
 * Verified directly: toggling the checkbox produces zero non-GET requests; clicking Save
 * Changes then produces `PUT /api/msels/{id}` → 200 and the flag is persisted. So the
 * app is fine and the test was simply not saving.
 *
 * The Save/Cancel controls are `mat-icon-button`s carrying `title`, not `aria-label`, so
 * `getByRole('button', { name: /Save Changes/i })` is the way to reach them — enumerating
 * accessible names alone will not surface them.
 */
test.describe('MSEL Management', () => {
  let token: string;
  let mselId: string;
  let mselName: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    mselName = tempBlueprintName('TestBP-Template');
    const created = await createMsel(token, {
      name: mselName,
      description: 'Test MSEL for template management',
      isTemplate: false,
    });
    mselId = created.id;
  });

  test.afterEach(async () => {
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('MSEL Template Management', async ({ blueprintAuthenticatedPage: page }) => {
    await navigateToMsel(page, mselId);

    const templateCheckbox = page.getByRole('checkbox', { name: /Is a Template/i });
    const saveButton = page.getByRole('button', { name: /Save Changes/i });

    await expect(templateCheckbox).toBeVisible({ timeout: 15000 });
    await expect(templateCheckbox).not.toBeChecked();
    // Nothing pending yet, so Save is inert.
    await expect(saveButton).toBeDisabled();

    await templateCheckbox.click();
    await expect(templateCheckbox).toBeChecked();
    // The edit is dirty-tracked but NOT yet sent.
    await expect(saveButton).toBeEnabled();

    // Pair the save click with the PUT it triggers, so the write is known-complete before
    // we navigate away — a bare click followed by goto() would cancel it in flight.
    const savePromise = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/msels/${mselId}`) &&
        r.request().method() === 'PUT' &&
        r.status() === 200,
      { timeout: 15000 }
    );
    await saveButton.click();
    await savePromise;

    // Save completing re-disables the button, which is the UI's own "no pending changes".
    await expect(saveButton).toBeDisabled();

    // The flag is really persisted server-side, not just held in local component state.
    expect((await getMsel(token, mselId)).isTemplate).toBe(true);

    // The Templates filter must now include this MSEL.
    await page.goto(`${Services.Blueprint.UI}/build`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 15000 });
    await selectTypeFilter(page, 'Templates');

    // Narrow by name: the list paginates and the dev stack already holds ~19 MSELs, so a
    // freshly-created row would otherwise land on page 2+.
    const searchBox = page.getByRole('textbox', { name: /search/i });
    await expect(searchBox).toBeVisible({ timeout: 10000 });
    await searchBox.fill(mselName);

    await expect(page.getByRole('row').filter({ hasText: mselName })).toBeVisible({
      timeout: 15000,
    });

    // Un-checking must persist too, and must drop it back out of the Templates filter.
    // The negative half is what proves the filter is actually keyed on isTemplate rather
    // than matching everything.
    await navigateToMsel(page, mselId);

    const checkboxAgain = page.getByRole('checkbox', { name: /Is a Template/i });
    const saveAgain = page.getByRole('button', { name: /Save Changes/i });
    await expect(checkboxAgain).toBeVisible({ timeout: 15000 });
    await expect(checkboxAgain).toBeChecked();

    const unsetPromise = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/msels/${mselId}`) &&
        r.request().method() === 'PUT' &&
        r.status() === 200,
      { timeout: 15000 }
    );
    await checkboxAgain.click();
    await expect(saveAgain).toBeEnabled();
    await saveAgain.click();
    await unsetPromise;

    await expect(checkboxAgain).not.toBeChecked();
    expect((await getMsel(token, mselId)).isTemplate).toBe(false);

    await page.goto(`${Services.Blueprint.UI}/build`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 15000 });
    await selectTypeFilter(page, 'Templates');

    await page.getByRole('textbox', { name: /search/i }).fill(mselName);
    await expect(page.getByRole('row').filter({ hasText: mselName })).toHaveCount(0, {
      timeout: 15000,
    });
  });
});

/** Open the /build list's type dropdown and pick an option by exact label. */
async function selectTypeFilter(page: any, optionLabel: string): Promise<void> {
  const typeFilter = page.getByRole('combobox', { name: /All Types/i }).first();
  await expect(typeFilter).toBeVisible({ timeout: 10000 });
  await typeFilter.click();

  const option = page.getByRole('option', { name: optionLabel, exact: true });
  await expect(option).toBeVisible({ timeout: 10000 });
  await option.click();
}
