// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Admin → Groups. GroupEndpointTests / GroupMembershipEndpointTests own the API; this spec
// covers the name dialog's required-name gate, the client-side search, the expandable
// membership panel (a user moves between the Users and Group Members tables) and the delete
// confirmation. The row buttons carry only a matTooltip, so they are located by icon.

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createBlueprintUser,
  deleteBlueprintUser,
  deleteBlueprintRecord,
  gotoBlueprintAdminSection,
  listGroups,
  listGroupMemberships,
  tempBlueprintName,
} from '../../test-helpers';

test.describe('Admin - Groups', () => {
  test('Group Lifecycle With Membership', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();
    const name = tempBlueprintName('Group');
    const renamed = tempBlueprintName('GroupRenamed');
    const user = await createBlueprintUser(token, { name: tempBlueprintName('GroupUser') });

    try {
      await gotoBlueprintAdminSection(page, 'Groups');
      const search = page.getByPlaceholder('Search Groups');
      await expect(search).toBeVisible();

      // 1. Create. Save stays disabled until a name is typed.
      await page.locator('th button:has(mat-icon[fonticon="mdi-plus-circle"])').click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText('Create New Group?');
      const save = dialog.getByRole('button', { name: 'Save' });
      await expect(save).toBeDisabled();
      await dialog.getByLabel('Name').fill(name);
      await expect(save).toBeEnabled();
      await save.click();
      await expect(dialog).toBeHidden();

      await search.fill(name);
      const row = page.locator('tr.element-row').filter({ hasText: name });
      await expect(row).toHaveCount(1);

      // 2. Rename. The dialog opens pre-filled; Cancel leaves the name unchanged.
      const renameButton = (r: typeof row) =>
        r.locator('button:has(mat-icon[fonticon="mdi-square-edit-outline"])');
      await renameButton(row).click();
      await expect(dialog).toContainText(`Rename ${name}`);
      await expect(dialog.getByLabel('Name')).toHaveValue(name);
      // expect: an untouched dialog has nothing to save.
      await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toBeHidden();
      await expect(row).toHaveCount(1);

      await renameButton(row).click();
      await dialog.getByLabel('Name').fill(renamed);
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(dialog).toBeHidden();
      // expect: the search is re-applied, so the old name no longer matches.
      await expect(row).toHaveCount(0);
      await search.fill(renamed);
      const renamedRow = page.locator('tr.element-row').filter({ hasText: renamed });
      await expect(renamedRow).toHaveCount(1);

      // 3. Expanding the row shows the membership panels; the group starts empty.
      await renamedRow.click();
      const users = page.locator('app-admin-groups-membership-list');
      const members = page.locator('app-admin-groups-member-list');
      await expect(members).toContainText('This Group currently has no members');

      // Adding a user moves them from Users into Group Members.
      await users.getByLabel('Search').fill(user.name);
      await users.getByRole('button', { name: `Add ${user.name}` }).click();
      const memberRow = members.locator('tr').filter({ hasText: user.name });
      await expect(memberRow).toHaveCount(1);
      await expect(users.getByRole('button', { name: `Add ${user.name}` })).toHaveCount(0);

      // Secondary: the membership reached the server.
      const group = (await listGroups(token)).find((g) => g.name === renamed);
      expect(group).toBeDefined();
      expect((await listGroupMemberships(token, group!.id)).map((m) => m.userId)).toEqual([
        user.id,
      ]);

      // Removing them puts them back in Users.
      await members.getByRole('button', { name: `Remove ${user.name}` }).click();
      await expect(members).toContainText('This Group currently has no members');
      await expect(users.getByRole('button', { name: `Add ${user.name}` })).toBeVisible();

      // 4. Delete, through the confirmation.
      await renamedRow.locator('button:has(mat-icon[fonticon="mdi-trash-can-outline"])').click();
      const confirm = page.getByRole('dialog').filter({ hasText: 'Delete Group?' });
      await expect(confirm).toContainText(`Delete Group ${renamed}?`);
      await confirm.getByRole('button', { name: 'Delete' }).click();
      await expect(renamedRow).toHaveCount(0);
    } finally {
      for (const g of await listGroups(token)) {
        if (g.name === name || g.name === renamed) {
          await deleteBlueprintRecord(token, 'groups', g.id);
        }
      }
      await deleteBlueprintUser(token, user.id);
    }
  });
});
