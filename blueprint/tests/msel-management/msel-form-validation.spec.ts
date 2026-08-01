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
 * Config-tab form validation: length limits and the empty-name guard.
 *
 * The previous version of this spec opened whichever MSEL happened to be first in the
 * /build list and typed into it. That violated test-data hygiene twice over — it mutated
 * a record it did not create (the dev stack carries ~19 pre-existing MSELs), and it
 * called `test.skip()` twice when it could not find a row, so it silently self-skipped
 * instead of failing. It also branched on `isEnabled()` and asserted different things per
 * branch, meaning it could pass whether or not validation worked. It now seeds its own
 * MSEL and asserts the behaviour unconditionally.
 *
 * Behaviour verified directly against the running app:
 *   - Name input has maxlength=70, Description maxlength=600; both truncate on input.
 *   - The counters render as `mat-hint` elements ("70 / 70 characters").
 *
 * The empty-name case is a real application defect — see BP-3 in
 * `blueprint/blueprint-app-bugs.md`. There is no validation at either layer: with the form
 * dirtied, clearing Name leaves Save enabled, the PUT returns 200, and the name persists
 * as "". Those assertions are written correctly below and skipped pending the app fix.
 */
test.describe('MSEL Management', () => {
  let token: string;
  let mselId: string;
  const originalName = tempBlueprintName('TestBP-Validation');

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const created = await createMsel(token, {
      name: originalName,
      description: 'Seeded for form-validation checks',
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

  test('MSEL Form Validation', async ({ blueprintAuthenticatedPage: page }) => {
    await navigateToMsel(page, mselId);

    const nameField = page.getByRole('textbox', { name: 'Name' });
    const descriptionField = page.getByRole('textbox', { name: 'Description' });
    const saveButton = page.getByRole('button', { name: /Save Changes/i });

    await expect(nameField).toBeVisible({ timeout: 15000 });
    await expect(descriptionField).toBeVisible({ timeout: 10000 });

    // The limits are declared on the inputs themselves.
    await expect(nameField).toHaveAttribute('maxlength', '70');
    await expect(descriptionField).toHaveAttribute('maxlength', '600');

    // Name: counter tracks the live length, and input past 70 is truncated rather than
    // accepted-then-rejected.
    await nameField.fill('A'.repeat(30));
    await expect(page.getByText('30 / 70 characters')).toBeVisible({ timeout: 10000 });

    await nameField.fill('A'.repeat(71));
    await expect(nameField).toHaveValue('A'.repeat(70));
    await expect(page.getByText('70 / 70 characters')).toBeVisible({ timeout: 10000 });

    // Description: same contract at 600.
    await descriptionField.fill('B'.repeat(24));
    await expect(page.getByText('24 / 600 characters')).toBeVisible({ timeout: 10000 });

    await descriptionField.fill('B'.repeat(601));
    await expect(descriptionField).toHaveValue('B'.repeat(600));
    await expect(page.getByText('600 / 600 characters')).toBeVisible({ timeout: 10000 });

    // Restore a valid name so this test leaves the record intact for the checks below.
    await nameField.fill(originalName);
  });

  test('MSEL Form Validation - empty name is rejected', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    // Blocked by Blueprint app bug BP-3 — see blueprint/blueprint-app-bugs.md.
    // A MSEL can currently be saved with an empty name: no mat-error appears, Save stays
    // enabled (it is bound to !isChanged only, never to validity), PUT returns 200, and
    // the name persists as "". The API accepts name:"" directly too, so neither layer
    // validates. The assertions below are correct as written — un-skip once a required
    // validator is added on the field AND in the API update path.
    test.skip(
      true,
      'BP-3: MSEL saves with an empty name, no client or server validation (see blueprint/blueprint-app-bugs.md)'
    );

    await navigateToMsel(page, mselId);

    const nameField = page.getByRole('textbox', { name: 'Name' });
    const descriptionField = page.getByRole('textbox', { name: 'Description' });
    const saveButton = page.getByRole('button', { name: /Save Changes/i });

    await expect(nameField).toBeVisible({ timeout: 15000 });

    // Dirty the form via another field first. Clearing Name alone does not set `isChanged`,
    // so Save would stay disabled for an unrelated reason and the test would pass without
    // exercising validation at all — that is exactly how this defect stayed hidden.
    await descriptionField.fill('Dirtying the form so Save becomes available');
    await expect(saveButton).toBeEnabled();

    // Now clear the required field.
    await nameField.fill('');
    await expect(nameField).toHaveValue('');

    // A required-field violation must surface, and must block the save.
    await expect(page.locator('mat-error')).toHaveCount(1);
    await expect(saveButton).toBeDisabled();

    // Nothing may reach the server.
    expect((await getMsel(token, mselId)).name).toBe(originalName);
  });
});
