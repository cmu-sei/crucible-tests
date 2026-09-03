// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import {
  seedUser,
  seedGroup,
  deleteUsersByPrefix,
  deleteGroupsByPrefix,
} from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

/**
 * A group's members are edited inline: expanding a group row reveals a "Users"
 * (non-members) list and a "Group Members" list. Clicking Add on a non-member POSTs a
 * membership and moves the user into the members list. This spec seeds a group and a
 * user, expands the group, adds the user, and confirms it lands in Group Members.
 */
test.describe('Group Management in Admin', () => {
  const GROUP_NAME = `E2E Member Group ${Date.now()}`;
  const USER_NAME = `E2E Member User ${Date.now()}`;

  test.beforeEach(async () => {
    await seedGroup(GROUP_NAME);
    await seedUser(USER_NAME);
  });

  test.afterEach(async () => {
    await deleteGroupsByPrefix(['E2E Member Group']);
    await deleteUsersByPrefix(['E2E Member User']);
  });

  test('Add a member to a group', async ({ steamfitterAuthenticatedPage: page }) => {
    await navigateToAdminSection(page, 'Groups');

    // Isolate and expand the seeded group's row.
    const groupSearch = page.getByRole('textbox', { name: 'Search Groups' });
    await groupSearch.fill(GROUP_NAME);
    const groupRow = page.locator('tbody tr').filter({ hasText: GROUP_NAME }).first();
    await expect(groupRow).toBeVisible({ timeout: 10000 });
    await groupRow.click();

    // The non-members list is headed "Users"; the members list "Group Members".
    const nonMembersList = page
      .locator('.mat-elevation-z8')
      .filter({ has: page.getByText('Users', { exact: true }) });
    const membersList = page
      .locator('.mat-elevation-z8')
      .filter({ has: page.getByText('Group Members', { exact: true }) });
    await expect(nonMembersList).toBeVisible({ timeout: 10000 });

    // Find the seeded user among non-members and add it (POSTs a membership).
    await nonMembersList.getByRole('textbox', { name: 'Search' }).fill(USER_NAME);
    const addResponse = page.waitForResponse(
      (response) =>
        /\/api\/groups\/.+\/memberships/.test(response.url()) &&
        response.request().method() === 'POST' &&
        response.ok(),
      { timeout: 15000 }
    );
    await nonMembersList.getByRole('button', { name: `Add ${USER_NAME}` }).click();
    await addResponse;

    // The user now appears in the Group Members list.
    await membersList.getByRole('textbox', { name: 'Search' }).fill(USER_NAME);
    await expect(
      membersList.locator('tbody tr').filter({ hasText: USER_NAME }).first()
    ).toBeVisible({ timeout: 10000 });
  });
});
