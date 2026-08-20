// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  getMsel,
  tempBlueprintName,
  navigateToMsel,
} from '../../test-helpers';

/**
 * Moving a MSEL through its status lifecycle from the Config tab.
 *
 * Previously test.fixme()'d with "the page navigates before the API call completes...
 * This appears to be an application timing issue rather than a test issue." That
 * diagnosis was wrong — the app is not racing. The Config tab is an **explicit-save**
 * form: changing the dropdown only sets the component's `isChanged` flag and issues no
 * request at all. Nothing persists until the **Save Changes** icon button is clicked.
 * The old test never clicked it, so there was no in-flight call to lose.
 *
 * Verified directly against the API: a full GET-then-PUT moving Pending → Approved →
 * Complete returns 200 and each value is persisted on the subsequent GET.
 *
 * Valid statuses come from `MselItemStatus` in
 * `Blueprint.Api.Data/Enumerations.cs`: Pending, Entered, Approved, Complete, Pushing,
 * Pulling, Deployed, Archived. Note "Active" is NOT a member — PUTting it yields a 400
 * JSON-conversion error, which is correct API behaviour rather than a defect.
 */
test.describe('MSEL Management', () => {
  let token: string;
  let mselId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const created = await createMsel(token, {
      name: tempBlueprintName('TestBP-Status'),
      description: 'Test MSEL for status lifecycle',
      status: 'Pending',
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

  test('MSEL Status Lifecycle', async ({ blueprintAuthenticatedPage: page }) => {
    await navigateToMsel(page, mselId);

    const statusDropdown = page.getByRole('combobox', { name: /MSEL Status/i });
    const saveButton = page.getByRole('button', { name: /Save Changes/i });

    await expect(statusDropdown).toBeVisible({ timeout: 15000 });
    await expect(statusDropdown).toContainText('Pending');
    await expect(saveButton).toBeDisabled();

    // The lifecycle statuses the UI offers must match the API enum.
    await statusDropdown.click();
    for (const status of ['Pending', 'Entered', 'Approved', 'Complete', 'Deployed', 'Archived']) {
      await expect(page.getByRole('option', { name: status, exact: true })).toBeVisible({
        timeout: 10000,
      });
    }

    await page.getByRole('option', { name: 'Entered', exact: true }).click();
    await expect(statusDropdown).toContainText('Entered');
    // Selecting only dirties the form; the write has not happened yet.
    await expect(saveButton).toBeEnabled();
    expect((await getMsel(token, mselId)).status).toBe('Pending');

    // Pair the save with its PUT so the write is known-complete before we re-navigate.
    const savePromise = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/msels/${mselId}`) &&
        r.request().method() === 'PUT' &&
        r.status() === 200,
      { timeout: 15000 }
    );
    await saveButton.click();
    await savePromise;

    await expect(saveButton).toBeDisabled();
    expect((await getMsel(token, mselId)).status).toBe('Entered');

    // Re-navigating must show the saved value — this is what the original test wanted to
    // prove, and it holds once the change is actually saved.
    await navigateToMsel(page, mselId);
    await expect(page.getByRole('combobox', { name: /MSEL Status/i })).toContainText('Entered', {
      timeout: 15000,
    });

    // Advance one more step to show the lifecycle moves forward, not just one field write.
    const dropdownAgain = page.getByRole('combobox', { name: /MSEL Status/i });
    const saveAgain = page.getByRole('button', { name: /Save Changes/i });

    await dropdownAgain.click();
    await page.getByRole('option', { name: 'Approved', exact: true }).click();
    await expect(saveAgain).toBeEnabled();

    const approvePromise = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/msels/${mselId}`) &&
        r.request().method() === 'PUT' &&
        r.status() === 200,
      { timeout: 15000 }
    );
    await saveAgain.click();
    await approvePromise;

    expect((await getMsel(token, mselId)).status).toBe('Approved');
  });
});
