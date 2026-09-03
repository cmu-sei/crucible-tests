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
  // Both names are torn down: whichever one the group ended up carrying when the
  // test stopped is the one that needs removing, and a failure mid-rename can
  // leave either. apiDeleteGroupByName no-ops when the name is not present.
  let originalName: string | undefined;
  let renamedName: string | undefined;

  test.afterEach(async () => {
    for (const name of [originalName, renamedName]) {
      if (name) {
        await apiDeleteGroupByName(name);
      }
    }
    originalName = undefined;
    renamedName = undefined;
  });

  test('Rename Group', async ({ galleryAuthenticatedPage: page }) => {
    await gotoGalleryAdmin(page);
    await gotoAdminSection(page, 'Groups');
    await expect(page.getByRole('columnheader', { name: 'Group Name' })).toBeVisible();

    // Setup: create the group this test renames. Include a random component
    // alongside the timestamp — parallel workers can call Date.now() in the same
    // millisecond and would otherwise collide on the name.
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    originalName = `Rename Group Before ${suffix}`;
    renamedName = `Rename Group After ${suffix}`;
    await createGalleryGroup(page, originalName);

    const originalRow = galleryGroupRow(page, originalName);

    // 1. Click the rename (pencil) icon on the group's row.
    // `displayedColumns` is ['actions', 'name'], so both row buttons live in the
    // first cell in the order [delete, rename]. Their `matTooltip` becomes
    // aria-describedby rather than an accessible name, so rename is addressed as
    // the last button rather than by name.
    await originalRow.getByRole('button').last().click();

    // expect: A 'Rename <group>' dialog opens with the Name field prefilled.
    // Scoped by accessible name (`updateGroup()` titles the dialog
    // 'Rename ' + group.name): an unscoped getByRole('dialog') would also match a
    // dialog still playing its exit animation, failing strict mode with
    // "resolved to 2 elements".
    const dialog = page.getByRole('dialog', { name: `Rename ${originalName}` });
    await expect(dialog).toBeVisible();

    const nameInput = dialog.getByRole('textbox', { name: 'Name' });
    await expect(nameInput).toHaveValue(originalName);

    // expect: The Save button is disabled until the name is changed.
    // `[submitDisabled]="!form.valid || !form.dirty"` in name-dialog.component.html —
    // a pristine form must not be submittable, which a visibility-only assertion
    // on the button would miss.
    const saveButton = dialog.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeDisabled();

    // 2. Enter a new name and click Save
    await nameInput.fill(renamedName);
    await expect(saveButton).toBeEnabled();

    const updated = page.waitForResponse(
      (response) =>
        /\/api\/groups\/[^/]+$/.test(response.url()) && response.request().method() === 'PUT'
    );
    await saveButton.click();

    // expect: The group is renamed successfully
    const response = await updated;
    expect(response.status()).toBe(200);
    expect((await response.json()).name).toBe(renamedName);

    // The dialog closing is the app's own confirmation that the save completed.
    await expect(dialog).toHaveCount(0);

    // expect: The new name appears in the groups list and the old name is gone.
    // Filter the list down to this group first so the assertion does not depend on
    // where the renamed group happens to sort.
    const searchField = page.getByRole('textbox', { name: 'Search Groups' });
    await searchField.fill(suffix);
    // Gallery search inputs filter on (keyup), so fill() alone sets the value
    // without applying the filter — a key event is required.
    await searchField.press('End');

    await expect(galleryGroupRow(page, renamedName)).toBeVisible();
    await expect(originalRow).toHaveCount(0);
    await expect(page.locator('app-admin-groups tr.element-row')).toHaveCount(1);

    // The original name no longer exists, so teardown only needs the new one.
    originalName = undefined;
  });
});
