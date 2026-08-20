// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  gotoCasterUsersAdmin,
  openAddUserDialog,
} from '../../fixtures';

/**
 * Users and Permissions Management §11.8 — Add New User.
 *
 * The Add User flow opens a modal built on the shared `crucible-dialog` component
 * from `@cmusei/crucible-common` (`add-user-dialog.component.*` in Caster.Ui). It
 * replaced an inline editable table row, so these specs pin the modal contract:
 * the dialog opens, validates, creates the user with the role picked at creation
 * time, and creates nothing when dismissed.
 *
 * The structural/accessibility half of that contract (title → content → actions,
 * button appearance, focus, dismissal) lives in
 * `tests/accessibility/add-user-dialog-modal-spec-compliance.spec.ts` so a
 * regression there names the design rule it broke.
 */
test.describe('Users and Permissions Management', () => {
  const userName = 'Playwright Modal User';
  // A fixed GUID keeps cleanup deterministic; the fixture pre-cleans by name, so a
  // leftover row from a failed run cannot collide on this id.
  const userId = '3f0b1a52-9c4d-4e7f-8a1b-2c3d4e5f6a7b';

  test('Add New User', async ({ casterAuthenticatedPage: page, cleanupCasterUser }) => {
    await cleanupCasterUser(userName);
    await gotoCasterUsersAdmin(page);

    // 1. Click the Add User button in the ID column header
    // expect: The Add User modal opens
    const dialog = await openAddUserDialog(page);
    await expect(dialog.getByRole('heading', { name: 'Add User' })).toBeVisible();

    const idField = dialog.getByRole('textbox', { name: 'User ID' });
    const nameField = dialog.getByRole('textbox', { name: 'Name' });
    const createButton = dialog.getByRole('button', { name: 'Create' });

    // expect: Create is disabled until the form is valid AND dirty
    // (crucible-dialog binds [submitDisabled]="!form.valid || !form.dirty")
    await expect(createButton).toBeDisabled();

    // 2. Enter an ID that is not a GUID
    await idField.fill('not-a-guid');
    await nameField.click(); // blur so the mat-error renders

    // expect: A validation error names the field and describes the fix, and the
    // form cannot be submitted. This validator is the point of the modal: the old
    // inline row showed a "Must be a valid Guid" tooltip that validated nothing.
    await expect(
      dialog.getByText(/User ID must be a valid GUID/),
    ).toBeVisible();
    await expect(createButton).toBeDisabled();

    // 3. Enter a name shorter than the 4-character minimum
    await idField.fill(userId);
    await nameField.fill('abc');
    await idField.click(); // blur the name field
    await expect(
      dialog.getByText(/Name must have a minimum of 4 characters/),
    ).toBeVisible();
    await expect(createButton).toBeDisabled();

    // 4. Enter a valid ID and Name
    await nameField.fill(userName);
    await expect(idField).toHaveValue(userId);
    await expect(nameField).toHaveValue(userName);

    // expect: No validation errors remain and Create is enabled
    await expect(dialog.locator('mat-error')).toHaveCount(0);
    await expect(createButton).toBeEnabled();

    // 5. Select a Role in the modal
    // expect: The seeded system roles are offered alongside the "None Locally" default.
    // Assigning the role here is new behavior — the old inline row created the user
    // with no role and required a second edit in the table to set one.
    await dialog.getByRole('combobox', { name: 'Role' }).click();
    await expect(page.getByRole('option')).toHaveText([
      'None Locally',
      'Observer',
      'Content Developer',
      'Administrator',
    ]);
    await page.getByRole('option', { name: 'Observer', exact: true }).click();
    await expect(dialog.getByRole('combobox', { name: 'Role' })).toContainText('Observer');

    // 6. Click Create
    const createResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/users') &&
        resp.request().method() === 'POST' &&
        resp.ok(),
    );
    await createButton.click();
    const response = await createResponse;

    // expect: The user is created with the id, name, and role from the modal
    expect(await response.json()).toMatchObject({
      id: userId,
      name: userName,
      roleId: expect.any(String),
    });

    // expect: The modal closes and the new user appears in the list with its role
    await expect(dialog).not.toBeVisible();
    const newRow = page.getByRole('row').filter({ hasText: userId });
    await expect(newRow).toHaveCount(1);
    await expect(newRow.getByRole('cell', { name: userName })).toBeVisible();
    await expect(newRow.getByRole('combobox')).toContainText('Observer');
  });

  test('Add New User - Cancel creates nothing', async ({
    casterAuthenticatedPage: page,
    cleanupCasterUser,
  }) => {
    const cancelledName = 'Playwright Cancelled User';
    await cleanupCasterUser(cancelledName);
    await gotoCasterUsersAdmin(page);

    const rowsBefore = await page.getByRole('row').count();

    // 1. Open the modal and fill it in completely
    const dialog = await openAddUserDialog(page);
    await dialog.getByRole('textbox', { name: 'User ID' }).fill('8c1d2e3f-4a5b-4c6d-9e7f-1a2b3c4d5e6f');
    await dialog.getByRole('textbox', { name: 'Name' }).fill(cancelledName);
    await expect(dialog.getByRole('button', { name: 'Create' })).toBeEnabled();

    // 2. Click Cancel instead of Create
    // A POST here would mean the host mistook the cancel result for a real user —
    // crucible-dialog closes with undefined on cancel and the host guards on
    // truthiness, so nothing should reach the API.
    let postCount = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/users') && req.method() === 'POST') postCount++;
    });
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    // expect: The modal closes and no user is created
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(rowsBefore);
    await expect(page.getByText(cancelledName)).toHaveCount(0);
    expect(postCount).toBe(0);

    // 3. Reopen the modal
    // expect: It comes up empty — a fresh dialog instance, not the cancelled state
    const reopened = await openAddUserDialog(page);
    await expect(reopened.getByRole('textbox', { name: 'User ID' })).toHaveValue('');
    await expect(reopened.getByRole('textbox', { name: 'Name' })).toHaveValue('');
    await expect(reopened.getByRole('button', { name: 'Create' })).toBeDisabled();
    await reopened.getByRole('button', { name: 'Cancel' }).click();
  });

  test('Add New User - Enter submits the form', async ({
    casterAuthenticatedPage: page,
    cleanupCasterUser,
  }) => {
    const enterName = 'Playwright Enter User';
    const enterId = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';
    await cleanupCasterUser(enterName);
    await gotoCasterUsersAdmin(page);

    // 1. Open the modal and fill in valid values
    const dialog = await openAddUserDialog(page);
    await dialog.getByRole('textbox', { name: 'User ID' }).fill(enterId);
    const nameField = dialog.getByRole('textbox', { name: 'Name' });
    await nameField.fill(enterName);

    // 2. Press Enter from inside a field rather than clicking Create.
    // This is why the modal uses crucible-dialog's form mode (§2b): the single
    // <form> wrapping content and actions is what makes Enter submit. A no-form
    // dialog would silently do nothing here.
    const createResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/users') &&
        resp.request().method() === 'POST' &&
        resp.ok(),
    );
    await nameField.press('Enter');
    await createResponse;

    // expect: The user is created and the modal closes
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: enterId })).toHaveCount(1);

    // expect: Role defaults to "None Locally" when the select is left untouched
    // (the modal maps the empty option to a null roleId).
    await expect(
      page.getByRole('row').filter({ hasText: enterId }).getByRole('combobox'),
    ).toContainText('None Locally');
  });
});
