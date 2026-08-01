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
 * When a save fails, the user must be told.
 *
 * Rewritten from a bare `test.fixme()` (which is invisible non-coverage) into a documented
 * skip backed by evidence, and re-pointed at a MSEL the test seeds itself — the previous
 * version opened whichever pre-existing MSEL happened to be named "New MSEL" or
 * "Project Lagoon" and edited it, which both violates test-data hygiene and stops testing
 * anything if those rows are absent.
 *
 * Verified behaviour with a forced 500 on `PUT /api/msels/{id}`: no snackbar, no
 * `[role="alert"]`, no error text anywhere on the page, and Save Changes re-disables exactly
 * as it does on success — so a lost edit looks like a saved one. See BP-9.
 */
test.describe('Error Handling and Validation', () => {
  let token: string;
  let mselId: string;
  let originalDescription: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    originalDescription = 'Seeded description';
    const msel = await createMsel(token, {
      name: tempBlueprintName('TestBP-ApiError'),
      description: originalDescription,
    });
    mselId = msel.id;
  });

  test.afterEach(async () => {
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('API Error Display', async ({ blueprintAuthenticatedPage: page }) => {
    // Blocked by Blueprint app bug BP-9 — see blueprint/blueprint-app-bugs.md.
    // A failed save produces no user-visible error and disables Save as though it worked,
    // so the edit is silently lost. The assertions below are correct as written — un-skip
    // once save failures surface to the user.
    test.skip(
      true,
      'BP-9: failed saves show no error and look successful (see blueprint/blueprint-app-bugs.md)'
    );

    await navigateToMsel(page, mselId);

    const descriptionField = page.getByRole('textbox', { name: 'Description' });
    const saveButton = page.getByRole('button', { name: /Save Changes/i });
    await expect(descriptionField).toBeVisible({ timeout: 15000 });

    // Type (don't fill) so the Config tab's keypress handlers mark the form dirty.
    await descriptionField.click();
    await descriptionField.fill('');
    await descriptionField.pressSequentially('This edit must not be lost silently');
    await expect(saveButton).toBeEnabled({ timeout: 10000 });

    // Force the save to fail.
    await page.route('**/api/msels/**', (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ title: 'Internal Server Error' }),
          })
        : route.continue()
    );

    await saveButton.click();

    // expect: the user is told the save failed.
    await expect(
      page
        .locator('simple-snack-bar, mat-snack-bar-container, .mat-mdc-snack-bar-container')
        .or(page.getByRole('alert'))
        .first()
    ).toBeVisible({ timeout: 10000 });

    // expect: the form stays dirty so the edit can be retried rather than retyped.
    await expect(saveButton).toBeEnabled();

    // expect: nothing was persisted.
    expect((await getMsel(token, mselId)).description).toBe(originalDescription);
  });
});
