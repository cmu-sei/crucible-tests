// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  gotoGalleryAdmin,
  gotoAdminSection,
  createGalleryGroup,
  galleryGroupRow,
  apiDeleteGroupByName,
} from '../../fixtures';

test.describe('Group Management', () => {
  // Registered before the create action and torn down in afterEach, so a failure
  // partway through still removes the row. Cleared once the UI delete is proven,
  // since at that point there is nothing left to remove.
  let testGroupName: string | undefined;

  test.afterEach(async () => {
    if (testGroupName) {
      await apiDeleteGroupByName(testGroupName);
      testGroupName = undefined;
    }
  });

  test('Delete Group', async ({ galleryAuthenticatedPage: page }) => {
    await gotoGalleryAdmin(page);
    await gotoAdminSection(page, 'Groups');
    await expect(page.getByRole('columnheader', { name: 'Group Name' })).toBeVisible();

    // Setup: create the group this test deletes. Include a random component
    // alongside the timestamp — parallel workers can call Date.now() in the same
    // millisecond and would otherwise collide on the name.
    testGroupName = `Delete Group Target ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    await createGalleryGroup(page, testGroupName);
    const row = galleryGroupRow(page, testGroupName);

    // 1. Click the delete (trash) icon on the group's row.
    // `displayedColumns` is ['actions', 'name'], so both row buttons live in the
    // first cell in the order [delete, rename]. Their `matTooltip` becomes
    // aria-describedby rather than an accessible name, so they are addressed by
    // position rather than by name.
    await row.getByRole('button').first().click();

    // expect: A 'Delete Group?' confirmation dialog appears naming the group.
    // Scoped by accessible name (`admin-groups.component.ts` opens this confirm
    // with `title: 'Delete Group?'`, which crucible-dialog renders in an
    // <h2 mat-dialog-title>). An unscoped getByRole('dialog') would also match the
    // create dialog while it is still playing its exit animation, failing strict
    // mode with "resolved to 2 elements".
    const confirmDialog = page.getByRole('dialog', { name: 'Delete Group?' });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText(`Delete Group ${testGroupName}?`);

    // 2. Click 'Cancel'
    await confirmDialog.getByRole('button', { name: 'Cancel' }).click();

    // expect: The dialog closes and the group is still listed.
    // Wait for detached rather than hidden so the reopen below cannot see two
    // dialogs at once.
    await confirmDialog.waitFor({ state: 'detached' });
    await expect(row).toBeVisible();

    // 3. Click the delete icon again and click 'Delete'
    await row.getByRole('button').first().click();
    await expect(confirmDialog).toBeVisible();

    const deleted = page.waitForResponse(
      (response) =>
        /\/api\/groups\/[^/]+$/.test(response.url()) && response.request().method() === 'DELETE'
    );
    await confirmDialog.getByRole('button', { name: 'Delete' }).click();

    // expect: The group is deleted successfully
    expect((await deleted).status()).toBe(204);

    // expect: The group is removed from the groups list.
    // toHaveCount(0) rather than not.toBeVisible(): the row leaves the DOM, and a
    // count assertion cannot pass vacuously.
    await expect(row).toHaveCount(0);

    // The UI delete is now proven, so there is nothing for teardown to remove.
    // Cleared only after the assertion, so a failure above still triggers cleanup.
    testGroupName = undefined;
  });
});
