// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Test: Remove Role from User
//
// In Blueprint, system roles are managed via the Users admin section at /admin (a SPA tab —
// the URL does not change). Each user row's Role cell holds a mat-select whose first option
// is a literal "None Locally", which maps to `roleId: null`. "Removing" a role therefore
// means selecting "None Locally".
//
// This test seeds its OWN user via `POST /api/users`, and seeds it *with* a role (the POST
// body honours `roleId`), so the precondition "this user has a role to remove" is
// established directly instead of by hunting the shared users table for a row that happens
// to have one. The seeded user is deleted in afterEach.
//
// This test:
//   1. Seeds a uniquely-named user already holding the Observer role (beforeEach)
//   2. Opens the Users admin section and filters the list down to that user
//   3. Asserts the seeded user really does start with the role — the precondition that
//      makes "removal" meaningful
//   4. Selects "None Locally" for that row
//   5. Asserts the row's role label falls back to "None Locally"
//   6. Asserts `GET /api/users/{id}` reports `roleId: null` — proving the removal persisted
//      rather than only clearing the mat-select's local selection

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
  setAdminUserRole,
  adminUserRoleLabel,
} from '../../test-helpers';

/** The role the seeded user starts with, and which this spec then removes. */
const ROLE_TO_REMOVE = 'Observer';

/** The dropdown option that clears a user's role (maps to `roleId: null`). */
const NO_ROLE_LABEL = 'None Locally';

test.describe('User and Role Management', () => {
  let token: string;
  let userId: string;
  let userName: string;
  let roleId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    userName = tempBlueprintName('RemoveRole-User');
    roleId = (await getSystemRoleByName(token, ROLE_TO_REMOVE)).id;

    // Seed our own user, already holding the role, rather than searching the shared users
    // table for one that has a role and reverting it afterwards. Setup via the API also keeps
    // the removal itself as the single UI action under test.
    const created = await createBlueprintUser(token, { name: userName, roleId });
    userId = created.id;

    // Setup must actually have taken effect, or step 4 would be "removing" nothing.
    expect(created.roleId).toBe(roleId);
  });

  test.afterEach(async () => {
    // Runs even when the test body throws, so a mid-test failure cannot leak the user.
    await deleteBlueprintUser(token, userId);
  });

  test('Remove Role from User', async ({ blueprintAuthenticatedPage: page }) => {
    await expect(page).toHaveURL(serviceUrlPattern(Services.Blueprint.UI), { timeout: 10000 });

    // 2. Navigate to the Users admin section
    // expect: Users admin section is visible with the user table
    await gotoBlueprintAdminSection(page, 'Users');

    // expect: Table has the expected column headers
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('columnheader', { name: 'Role' })).toBeVisible({ timeout: 5000 });

    // 3. Filter the (paginated) list down to the seeded user and scope everything below to
    // that one row. Never index into the unfiltered table — the seeded row rarely lands on
    // page 1, and a row picked by position can be a user another spec is concurrently editing.
    const userRow = await findAdminUserRowByName(page, userName);
    await expect(userRow).toContainText(userId);

    // expect: The precondition holds — the row shows the role that is about to be removed.
    // Without this, a "shows None Locally at the end" assertion would also pass for a user
    // that never had a role.
    const roleLabel = adminUserRoleLabel(userRow);
    await expect(roleLabel).toHaveText(ROLE_TO_REMOVE);

    // ...and it holds server-side too, not just as a rendered label.
    expect((await getBlueprintUser(token, userId)).roleId).toBe(roleId);

    // 4. Remove the role by selecting "None Locally"
    await setAdminUserRole(page, userRow, userId, NO_ROLE_LABEL);

    // 5. expect: The row's role label falls back to "None Locally"
    await expect(roleLabel).toHaveText(NO_ROLE_LABEL);

    // 6. expect: The removal persisted server-side — `roleId` is back to null.
    // This is the assertion with teeth: the mat-select holds its own selection independently
    // of the app's store, so the label alone would read "None Locally" even if the PUT had
    // never been applied.
    const persisted = await getBlueprintUser(token, userId);
    expect(persisted.roleId).toBeNull();

    // expect: ...and a fresh load of the users list still shows no role, so the removal
    // survives beyond the component that made it.
    await gotoBlueprintAdminSection(page, 'Users');
    const reloadedRow = await findAdminUserRowByName(page, userName);
    await expect(adminUserRoleLabel(reloadedRow)).toHaveText(NO_ROLE_LABEL);
  });
});
