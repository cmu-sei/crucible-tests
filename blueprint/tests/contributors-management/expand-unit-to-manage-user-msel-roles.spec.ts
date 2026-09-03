// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Test: Expand Unit to Manage User MSEL Roles (plan item 5.4)
//
// Consolidated from two duplicate specs, both of which were previously test.fixme()'d.
//
// Two earlier claims about this test were wrong, and both are worth recording because each
// produced a test that could not fail:
//
//  1. "Users can't be seeded — Blueprint provisions them on first Keycloak login, so this
//     test can only use the admin user." Not true. `POST /api/users` accepts a
//     client-supplied id and returns 201, and `POST /api/unitusers` (201) puts that user in
//     a unit. Both are wrapped as `createBlueprintUser` / `addUserToUnit` in test-helpers.
//     So the unit under test can have a real member, which is the whole point of the
//     plan item ("expand the unit row to manage its users' MSEL roles").
//
//  2. The role control was located as `mat-checkbox`. There are no checkboxes here. The
//     expanded row renders, per user, a **multi-select `mat-select` labelled "MSEL Roles"`**
//     (msel-contributors.component.html). The old locator therefore matched 0 elements, and
//     an `if (count > 0) ... else assert the row is still visible` fallback hid that: the
//     else branch re-asserted something proven four lines earlier, so both branches passed
//     unconditionally and the spec's named behaviour went entirely untested.
//
// MselRole values come from Blueprint.Api.Data/Enumerations.cs:
//   Owner=10, Editor=20, Approver=30, MoveEditor=40, Viewer=50, Evaluator=60
//
// Coverage: seed a MSEL, a unit and a user; put the user in the unit; add the unit to the
// MSEL; expand the unit row; assert the seeded user and the MSEL Roles control render;
// select a role and assert it persists (both in the UI control and via the API).

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createUnit,
  deleteUnit,
  createBlueprintUser,
  deleteBlueprintUser,
  addUserToUnit,
  removeUserFromUnit,
  addUnitToMsel,
  removeUnitFromMsel,
  listUnitUsers,
  tempBlueprintName,
  navigateToMselSection,
} from '../../test-helpers';

test.describe('Contributors Management', () => {
  let token: string;
  let mselId: string;
  let unitId: string;
  let userId: string;
  let userName: string;
  let unitShortName: string;
  let unitUserId: string | null = null;
  let mselUnitJoinId: string | null = null;

  test.beforeEach(async () => {
    token = await getBlueprintToken();

    userName = tempBlueprintName('ExpandUnit-User');
    unitShortName = `EU${Date.now() % 100000}`;

    const msel = await createMsel(token, {
      name: tempBlueprintName('ExpandUnit-MSEL'),
      description: 'Seeded for expand-unit role management',
    });
    mselId = msel.id;

    const unit = await createUnit(token, {
      name: tempBlueprintName('ExpandUnit-Unit'),
      shortName: unitShortName,
    });
    unitId = unit.id;

    const user = await createBlueprintUser(token, { name: userName });
    userId = user.id;

    // Put the user in the unit, then make the unit a MSEL contributor. Order matters only
    // in that both must exist before the Contributors row can expand to anything useful.
    unitUserId = (await addUserToUnit(token, unitId, userId)).id;
    mselUnitJoinId = (await addUnitToMsel(token, mselId, unitId)).id;

    // Precondition, asserted rather than assumed: without a real member in the unit the
    // expanded row is legitimately empty and the role assertions below would be vacuous.
    const members = await listUnitUsers(token, unitId);
    expect(
      members.map((u: any) => u.id),
      'seeded user must be a member of the seeded unit'
    ).toContain(userId);
  });

  test.afterEach(async () => {
    if (mselUnitJoinId) await removeUnitFromMsel(token, mselUnitJoinId);
    if (unitUserId) await removeUserFromUnit(token, unitUserId);
    await deleteMsel(token, mselId);
    await deleteUnit(token, unitId);
    await deleteBlueprintUser(token, userId);
    unitUserId = null;
    mselUnitJoinId = null;
  });

  test('Expand Unit to Manage User MSEL Roles', async ({ blueprintAuthenticatedPage: page }) => {
    await navigateToMselSection(page, mselId, 'Contributors');

    const contributors = page.locator('app-msel-contributors').first();
    await expect(contributors).toBeVisible({ timeout: 10000 });

    // 1. The seeded unit appears as a contributor.
    const unitRow = page
      .locator('table tbody tr, mat-row')
      .filter({ hasText: unitShortName })
      .first();
    await expect(unitRow).toBeVisible({ timeout: 10000 });

    // 2. Expand the unit row.
    await unitRow.click();

    const expandedDetail = page.locator('.expanded-detail-div').first();
    await expect(expandedDetail).toBeVisible({ timeout: 10000 });

    // expect: the expanded area lists the unit's member.
    await expect(expandedDetail.getByText(userName, { exact: true })).toBeVisible({
      timeout: 10000,
    });

    // 3. The per-user "MSEL Roles" control renders. This is a multi-select mat-select,
    //    not a checkbox — see the header note.
    const userDetail = expandedDetail.locator('.unit-detail').filter({ hasText: userName }).first();
    const rolesSelect = userDetail.getByRole('combobox', { name: /MSEL Roles/i }).first();
    await expect(rolesSelect).toBeVisible({ timeout: 10000 });

    // 4. Assign a role and assert it persists. `setMselRoles` diffs against the current
    //    selection and POSTs each addition, so pair the click with that request.
    await rolesSelect.click();

    const editorOption = page.getByRole('option', { name: 'Editor', exact: true }).first();
    await expect(editorOption).toBeVisible({ timeout: 10000 });

    const roleAdded = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        /\/api\/usermselroles/i.test(new URL(r.url()).pathname) &&
        r.ok(),
      { timeout: 15000 }
    );
    await editorOption.click();
    await roleAdded;

    // Close the multi-select overlay so the trigger text can be read.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0, { timeout: 10000 });

    // expect: the control now reflects the assigned role.
    await expect(rolesSelect).toContainText('Editor', { timeout: 10000 });

    // expect: and it really persisted — reload and re-read from a fresh render, so this
    // proves server state rather than a client-side selection that was never saved.
    await navigateToMselSection(page, mselId, 'Contributors');
    const reloadedRow = page
      .locator('table tbody tr, mat-row')
      .filter({ hasText: unitShortName })
      .first();
    await expect(reloadedRow).toBeVisible({ timeout: 10000 });
    await reloadedRow.click();

    const reloadedDetail = page.locator('.expanded-detail-div').first();
    await expect(reloadedDetail).toBeVisible({ timeout: 10000 });
    const reloadedRolesSelect = reloadedDetail
      .locator('.unit-detail')
      .filter({ hasText: userName })
      .first()
      .getByRole('combobox', { name: /MSEL Roles/i })
      .first();
    await expect(reloadedRolesSelect).toContainText('Editor', { timeout: 10000 });
  });
});
