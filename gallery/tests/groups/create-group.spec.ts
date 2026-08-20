// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoGalleryAdmin, gotoAdminSection, apiDeleteGroupByName } from '../../fixtures';

test.describe('Group Management', () => {
  // Registered before the create action and torn down in afterEach, so a failure
  // partway through the test still removes the row. Include a random component
  // alongside the timestamp: parallel workers can call Date.now() in the same
  // millisecond and would otherwise collide on the name.
  let testGroupName: string | undefined;

  test.afterEach(async () => {
    if (testGroupName) {
      await apiDeleteGroupByName(testGroupName);
      testGroupName = undefined;
    }
  });

  test('Create Group', async ({ galleryAuthenticatedPage: page }) => {
    await gotoGalleryAdmin(page);
    await gotoAdminSection(page, 'Groups');
    await expect(page.getByRole('columnheader', { name: 'Group Name' })).toBeVisible();

    // 1. Click the Add Group button (plus icon)
    // The toolbar buttons use matTooltip, which yields aria-describedby rather than
    // an accessible name, so they are addressed structurally.
    const addGroupButton = page.locator('app-admin-groups th.mat-column-actions button').first();
    await expect(addGroupButton).toBeVisible();
    await addGroupButton.click();

    // expect: A group creation dialog or form opens
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // NameDialogComponent is opened with the title 'Create New Group?' — asserting it
    // proves this is the create dialog and not some other overlay.
    await expect(dialog).toContainText('Create New Group?');

    // 2. Enter a group name and save.
    // Register the name for cleanup *before* the POST so teardown covers the row even
    // if the assertions below fail.
    testGroupName = `Test Group ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    await dialog.getByRole('textbox').fill(testGroupName);

    const created = page.waitForResponse(
      (response) => response.url().endsWith('/api/groups') && response.request().method() === 'POST'
    );
    await dialog.getByRole('button', { name: 'Save' }).click();

    // expect: Group is created successfully
    const response = await created;
    expect(response.status()).toBe(201);
    expect((await response.json()).name).toBe(testGroupName);

    // The dialog closing is the app's own confirmation that the save completed.
    await expect(dialog).not.toBeVisible();

    // expect: New group appears in the groups list.
    // Filter the (unpaginated but potentially long) list down to this row first so
    // the assertion does not depend on where the new group happens to sort.
    const searchField = page.getByRole('textbox', { name: 'Search Groups' });
    await searchField.fill(testGroupName);
    // Gallery search inputs filter on (keyup), so fill() alone does not apply the
    // filter — a key event is required.
    await searchField.press('End');

    await expect(page.locator('app-admin-groups tr.element-row')).toHaveCount(1);
    await expect(page.getByRole('cell', { name: testGroupName })).toBeVisible();
  });
});
