// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoGalleryAdmin, gotoAdminSection, apiDeleteGroupByName } from '../../fixtures';

/**
 * Test-plan step 9.4 describes step 2 as "link the group to a collection or exhibit",
 * but the shipped UI does not do that: `admin-groups-detail.component.html` composes
 * `app-admin-groups-membership-list` (all non-member *users*) next to
 * `app-admin-groups-member-list` (current members), and the group API's membership
 * endpoints (`POST /api/groups/{groupId}/memberships`,
 * `DELETE /api/groups/memberships/{id}`) take a userId. A group membership is
 * therefore a user↔group link. This spec asserts the behavior the app actually has:
 * add a user, verify the membership POST and the row moving between the two panels,
 * then remove it and verify the DELETE and the empty-state message.
 */
test.describe('Group Management', () => {
  let testGroupName: string | undefined;

  test.afterEach(async () => {
    if (testGroupName) {
      // Deleting the group removes its memberships too, so this one call is enough.
      await apiDeleteGroupByName(testGroupName);
      testGroupName = undefined;
    }
  });

  test('Group Membership Management', async ({ galleryAuthenticatedPage: page }) => {
    await gotoGalleryAdmin(page);
    await gotoAdminSection(page, 'Groups');
    await expect(page.getByRole('columnheader', { name: 'Group Name' })).toBeVisible();

    // Setup: create a group to manage memberships on. Register the name for cleanup
    // before the create action so teardown covers it even on a mid-test failure.
    testGroupName = `Membership Group ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    // matTooltip on the Groups toolbar buttons is exposed as aria-describedby, not an
    // accessible name, so the plus icon is addressed structurally.
    const addGroupButton = page.locator('app-admin-groups th.mat-column-actions button').first();
    await expect(addGroupButton).toBeVisible();
    await addGroupButton.click();

    const createDialog = page.getByRole('dialog');
    await expect(createDialog).toBeVisible();
    await createDialog.getByRole('textbox').fill(testGroupName);
    await createDialog.getByRole('button', { name: 'Save' }).click();
    await expect(createDialog).not.toBeVisible();

    // Collapse the list onto this row so the click below cannot land on a sibling
    // spec's group. The search input filters on (keyup), so fill() needs a key event.
    const searchField = page.getByRole('textbox', { name: 'Search Groups' });
    await searchField.fill(testGroupName);
    await searchField.press('End');
    await expect(page.locator('app-admin-groups tr.element-row')).toHaveCount(1);

    // 1. Click on a group to view its details
    const groupRow = page.locator('app-admin-groups tr.element-row').filter({ hasText: testGroupName });
    await expect(groupRow).toBeVisible();
    await groupRow.click();

    // expect: Group detail view opens showing group information and memberships.
    // The detail row renders two panels; both must be present.
    const usersPanel = page.locator('app-admin-groups-membership-list');
    const membersPanel = page.locator('app-admin-groups-member-list');
    await expect(usersPanel.getByText('Users', { exact: true })).toBeVisible();
    await expect(membersPanel.getByText('Group Members', { exact: true })).toBeVisible();

    // A brand-new group has no members, and the members table says so explicitly.
    await expect(membersPanel.getByText('This Group currently has no members')).toBeVisible();

    // The candidate user must appear in the non-members panel before it can be added.
    // 'Admin User' is the Gallery user record for the admin account the suite runs as
    // and is guaranteed to exist (global-setup authenticates as it).
    const candidateRow = usersPanel.getByRole('row').filter({ hasText: 'Admin User' });
    await expect(candidateRow).toBeVisible();

    // 2. Add a membership.
    // These row buttons *do* use `title` ("Add {{ user.name }}"), so they have a real
    // accessible name.
    const addMemberButton = usersPanel.getByRole('button', { name: 'Add Admin User' });
    await expect(addMemberButton).toBeVisible();

    const membershipCreated = page.waitForResponse(
      (response) =>
        /\/api\/groups\/[^/]+\/memberships$/.test(response.url()) &&
        response.request().method() === 'POST'
    );
    await addMemberButton.click();

    // expect: Membership is created successfully
    const createResponse = await membershipCreated;
    expect(createResponse.status()).toBe(201);
    const membership = await createResponse.json();
    expect(membership.userId).toBeTruthy();

    // expect: the UI reflects it — the user moves out of the candidate panel and into
    // Group Members. toHaveCount(0) rather than not.toBeVisible(): the filtered-out
    // row leaves the DOM, and a getByRole visibility check can pass vacuously.
    await expect(membersPanel.getByRole('cell', { name: 'Admin User' })).toBeVisible();
    await expect(membersPanel.getByText('This Group currently has no members')).toHaveCount(0);
    await expect(usersPanel.getByRole('row').filter({ hasText: 'Admin User' })).toHaveCount(0);

    // 3. Remove the membership from the group
    const removeMemberButton = membersPanel.getByRole('button', { name: 'Remove Admin User' });
    await expect(removeMemberButton).toBeVisible();

    const membershipDeleted = page.waitForResponse(
      (response) =>
        /\/api\/groups\/memberships\/[^/]+$/.test(response.url()) &&
        response.request().method() === 'DELETE'
    );
    await removeMemberButton.click();

    // expect: Membership is removed successfully
    expect((await membershipDeleted).status()).toBe(204);

    // expect: the members table is empty again and the user is offered as a candidate.
    await expect(membersPanel.getByRole('cell', { name: 'Admin User' })).toHaveCount(0);
    await expect(membersPanel.getByText('This Group currently has no members')).toBeVisible();
    await expect(usersPanel.getByRole('row').filter({ hasText: 'Admin User' })).toBeVisible();
  });
});
