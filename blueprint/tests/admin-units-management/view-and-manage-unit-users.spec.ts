// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Adding and removing unit members from an expanded Admin → Units row. The previous version
// only checked that the two panels and an enabled Add button existed; it never clicked it.
//
// The expanded row shows two tables: "Users" (everyone *not* in the unit) and "Unit Members".
// Adding a user moves them from the first to the second, and removing moves them back. Both
// tables paginate, so the seeded user is always found by searching (these Search boxes are
// formControls, so fill() is enough).

import type { Locator, Page } from '@playwright/test';
import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  createUnit,
  deleteUnit,
  createBlueprintUser,
  deleteBlueprintUser,
  tempBlueprintName,
} from '../../test-helpers';

/** The "Users" or "Unit Members" half of the expanded row. */
const panel = (detail: Locator, title: 'Users' | 'Unit Members') =>
  detail
    .locator('.user-list-container, .unit-list-container')
    .filter({ has: detail.page().locator('mat-toolbar p', { hasText: new RegExp(`^${title}$`) }) });

async function openUnit(page: Page, unitName: string): Promise<Locator> {
  await page.goto(`${Services.Blueprint.UI}/admin`);
  const unitsNav = page.locator('mat-list-item').filter({ hasText: 'Units' }).first();
  await expect(unitsNav).toBeVisible({ timeout: 30000 });
  await unitsNav.click();
  const search = page.getByRole('textbox', { name: 'Search' }).first();
  await expect(search).toBeVisible({ timeout: 15000 });
  // The units list filters on (keyup), so type the term.
  await search.pressSequentially(unitName);
  const row = page.getByRole('row').filter({ hasText: unitName });
  await expect(row).toHaveCount(1, { timeout: 15000 });
  await row.click();
  const detail = page.locator('app-admin-unit-users');
  await expect(detail).toBeVisible();
  return detail;
}

test.describe('Admin - Units Management', () => {
  let token: string;
  let unitId: string | undefined;
  let userId: string | undefined;

  test.afterEach(async () => {
    if (unitId) await deleteUnit(token, unitId);
    if (userId) await deleteBlueprintUser(token, userId);
  });

  test('View and Manage Unit Users', async ({ blueprintAuthenticatedPage: page }) => {
    token = await getBlueprintToken();
    const unitName = tempBlueprintName('UnitUsers');
    unitId = (await createUnit(token, { name: unitName })).id;
    const user = await createBlueprintUser(token);
    userId = user.id;

    // 1. Expand the unit.
    const detail = await openUnit(page, unitName);
    const users = panel(detail, 'Users');
    const members = panel(detail, 'Unit Members');
    await users.getByPlaceholder('Search').fill(user.name);
    await members.getByPlaceholder('Search').fill(user.name);

    //    expect: the new user is offered under Users and is not yet a member.
    await expect(users.getByRole('button', { name: `Add ${user.name}` })).toBeVisible({
      timeout: 15000,
    });
    await expect(members.getByRole('button', { name: `Remove ${user.name}` })).toHaveCount(0);

    // 2. Add them.
    await users.getByRole('button', { name: `Add ${user.name}` }).click();
    //    expect: they move from Users to Unit Members.
    await expect(members.getByRole('button', { name: `Remove ${user.name}` })).toBeVisible({
      timeout: 15000,
    });
    await expect(users.getByRole('button', { name: `Add ${user.name}` })).toHaveCount(0);

    // 3. Reload and reopen the unit.
    //    expect: the membership persisted.
    const reopened = await openUnit(page, unitName);
    const reopenedMembers = panel(reopened, 'Unit Members');
    await reopenedMembers.getByPlaceholder('Search').fill(user.name);
    await expect(reopenedMembers.getByRole('button', { name: `Remove ${user.name}` })).toBeVisible({
      timeout: 15000,
    });

    // 4. Remove them.
    const reopenedUsers = panel(reopened, 'Users');
    const usersSearch = reopenedUsers.getByPlaceholder('Search');
    await usersSearch.fill(user.name);
    await expect(reopenedUsers.locator('mat-row')).toHaveCount(0);
    await reopenedMembers.getByRole('button', { name: `Remove ${user.name}` }).click();
    await expect(reopenedMembers.getByRole('button', { name: `Remove ${user.name}` })).toHaveCount(0, {
      timeout: 15000,
    });

    // Pending upstream: every membership change makes `setDataSources()` replace the Users
    // table's `MatTableDataSource` with a fresh one that carries no filter, so the Search box
    // keeps its text while the table goes back to listing every user, page 1. Asserting that
    // the table no longer honours the search, then re-entering the term. When the component
    // re-applies `filterControl.value` to the new data source, drop the re-entry and assert
    // the user reappears under the search that is still in the box.
    await expect(usersSearch).toHaveValue(user.name);
    await expect(reopenedUsers.locator('mat-row').filter({ hasNotText: user.name }).first()).toBeVisible();
    await usersSearch.fill('');
    await usersSearch.fill(user.name);

    //    expect: they move back to Users.
    await expect(reopenedUsers.getByRole('button', { name: `Add ${user.name}` })).toBeVisible({
      timeout: 15000,
    });

    // 5. Collapse the row.
    //    expect: the member panels close.
    await page.getByRole('row').filter({ hasText: unitName }).click();
    await expect(reopened).toBeHidden();
  });
});
