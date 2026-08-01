// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Test: Assign Role to User
//
// In Blueprint, system roles are assigned via the Users admin section at /admin (a SPA
// tab — the URL does not change). The Users table has ID, Name and Role columns; the Role
// cell holds a mat-select whose first option is a literal "None Locally" (meaning
// `roleId: null`) followed by one option per system role from `GET /api/system-roles`.
//
// This test seeds its OWN user via `POST /api/users` so the starting state is
// deterministic: a fresh user has `roleId: null`, i.e. "None Locally". It then assigns a
// real role and asserts the change persisted server-side. The seeded user is deleted in
// afterEach, so nothing here depends on — or mutates — any pre-existing user row.
//
// This test:
//   1. Seeds a uniquely-named user with no role (beforeEach)
//   2. Opens the Users admin section and filters the list down to that user
//   3. Asserts the seeded user starts at "None Locally"
//   4. Opens the role dropdown and verifies the expected role options are offered
//   5. Assigns "Observer" and asserts the trigger label changes
//   6. Asserts `GET /api/users/{id}` now reports the Observer role id — proving the
//      assignment persisted rather than only updating the mat-select's local selection

import { test, expect, Services, serviceUrlPattern } from '../../fixtures';
import {
  getBlueprintToken,
  createBlueprintUser,
  deleteBlueprintUser,
  getBlueprintUser,
  getSystemRoleByName,
  tempBlueprintName,
  gotoBlueprintAdminSection,
  findAdminUserRowByName,
  openAdminUserRolePanel,
  setAdminUserRole,
  adminUserRoleLabel,
} from '../../test-helpers';

/** The role this spec assigns. Any non-null system role would do. */
const ROLE_TO_ASSIGN = 'Observer';

test.describe('User and Role Management', () => {
  let token: string;
  let userId: string;
  let userName: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    userName = tempBlueprintName('AssignRole-User');

    // Seed our own user rather than borrowing a row from the shared users table. A fresh
    // user has roleId: null, so the starting role is known to be "None Locally" and no
    // branching on "whatever state the shared user was in" is needed.
    const created = await createBlueprintUser(token, { name: userName });
    userId = created.id;
    expect(created.roleId).toBeNull();
  });

  test.afterEach(async () => {
    // Runs even when the test body throws, so a mid-test failure cannot leak the user.
    await deleteBlueprintUser(token, userId);
  });

  test('Assign Role to User', async ({ blueprintAuthenticatedPage: page }) => {
    await expect(page).toHaveURL(serviceUrlPattern(Services.Blueprint.UI), { timeout: 10000 });

    const roleToAssign = await getSystemRoleByName(token, ROLE_TO_ASSIGN);

    // 2. Navigate to the Users admin section
    // expect: Users admin section is visible with the user table
    await gotoBlueprintAdminSection(page, 'Users');

    // expect: Table has the expected column headers
    await expect(page.getByRole('columnheader', { name: 'ID' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('columnheader', { name: 'Role' })).toBeVisible({ timeout: 5000 });

    // 3. Filter the (paginated) list down to the seeded user and scope everything below to
    // that one row. Never index into the unfiltered table — the seeded row rarely lands on
    // page 1, and a row picked by position can be a user another spec is concurrently editing.
    const userRow = await findAdminUserRowByName(page, userName);

    // expect: The seeded user's row shows its id and name
    await expect(userRow).toContainText(userId);
    await expect(userRow).toContainText(userName);

    // expect: The seeded user starts with no role — deterministic, because we just created it
    const roleLabel = adminUserRoleLabel(userRow);
    await expect(roleLabel).toHaveText('None Locally');

    // 4. Open this row's role dropdown
    // expect: Dropdown opens listing "None Locally" plus every system role
    const panel = await openAdminUserRolePanel(page, userRow);

    await expect(panel.getByRole('option', { name: 'None Locally', exact: true })).toBeVisible({
      timeout: 5000,
    });
    for (const builtInRole of ['Observer', 'Content Developer', 'Administrator']) {
      await expect(panel.getByRole('option', { name: builtInRole, exact: true })).toBeVisible({
        timeout: 5000,
      });
    }

    // expect: "None Locally" is the currently-selected option
    await expect(
      panel.getByRole('option', { name: 'None Locally', exact: true })
    ).toHaveAttribute('aria-selected', 'true');

    // 5. Assign the role. Closing the panel first keeps setAdminUserRole's own
    // open-then-select flow unambiguous.
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden({ timeout: 5000 });

    await setAdminUserRole(page, userRow, userId, ROLE_TO_ASSIGN);

    // expect: The row's role label now shows the assigned role
    await expect(roleLabel).toHaveText(ROLE_TO_ASSIGN);

    // 6. expect: The assignment persisted server-side.
    // This is the assertion that actually has teeth. The mat-select keeps its own selection
    // independently of the app's store, so a UI label alone would still read "Observer" even
    // if the PUT had never been applied.
    const persisted = await getBlueprintUser(token, userId);
    expect(persisted.roleId).toBe(roleToAssign.id);

    // expect: ...and re-reading the row after a full page load still shows the role, so the
    // change survives a fresh load of the users list rather than living only in the
    // component that made it.
    await gotoBlueprintAdminSection(page, 'Users');
    const reloadedRow = await findAdminUserRowByName(page, userName);
    await expect(adminUserRoleLabel(reloadedRow)).toHaveText(ROLE_TO_ASSIGN);
  });
});
