// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import {
  seedUser,
  seedGroup,
  seedGroupMembership,
  deleteUsersByPrefix,
  deleteGroupsByPrefix,
} from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

/**
 * Removing a group member is immediate (no confirm dialog): clicking Remove in the
 * "Group Members" list DELETEs the membership and drops the user back to the non-members
 * list. This spec seeds a group with a member (via API), expands the group, removes the
 * member, and confirms it disappears from Group Members.
 */
test.describe('Group Management in Admin', () => {
  const GROUP_NAME = `E2E Remove Group ${Date.now()}`;
  const USER_NAME = `E2E Remove User ${Date.now()}`;
  let groupId: string;
  let userId: string;

  test.beforeEach(async () => {
    groupId = await seedGroup(GROUP_NAME);
    userId = await seedUser(USER_NAME);
    await seedGroupMembership(groupId, userId);
  });

  test.afterEach(async () => {
    await deleteGroupsByPrefix(['E2E Remove Group']);
    await deleteUsersByPrefix(['E2E Remove User']);
  });

  test('Remove a member from a group', async ({ steamfitterAuthenticatedPage: page }) => {
    await navigateToAdminSection(page, 'Groups');

    // Isolate and expand the seeded group's row.
    const groupSearch = page.getByRole('textbox', { name: 'Search Groups' });
    await groupSearch.fill(GROUP_NAME);
    await page.waitForTimeout(500);
    const groupRow = page.locator('tbody tr').filter({ hasText: GROUP_NAME }).first();
    await expect(groupRow).toBeVisible({ timeout: 10000 });
    await groupRow.click();

    const membersList = page
      .locator('.mat-elevation-z8')
      .filter({ has: page.getByText('Group Members', { exact: true }) });
    await expect(membersList).toBeVisible({ timeout: 10000 });

    // Isolate the seeded member and remove it (DELETEs the membership).
    await membersList.getByRole('textbox', { name: 'Search' }).fill(USER_NAME);
    await page.waitForTimeout(500);
    await expect(
      membersList.locator('tbody tr').filter({ hasText: USER_NAME }).first()
    ).toBeVisible({ timeout: 10000 });

    const deleteResponse = page.waitForResponse(
      (response) =>
        /\/api\/groups\/memberships\//.test(response.url()) &&
        response.request().method() === 'DELETE' &&
        response.ok(),
      { timeout: 15000 }
    );
    await membersList.getByRole('button', { name: `Remove ${USER_NAME}` }).click();
    await deleteResponse;

    // The member should no longer be listed. (The empty-state row echoes the filter
    // text, so assert on the per-member Remove button, which only real rows render.)
    await expect(
      membersList.getByRole('button', { name: `Remove ${USER_NAME}` })
    ).toHaveCount(0, { timeout: 10000 });
  });
});
