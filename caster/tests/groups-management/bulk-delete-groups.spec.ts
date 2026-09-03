// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  casterGroupCell,
  createCasterGroup,
  deleteCasterGroup,
  gotoCasterGroupsAdmin,
} from '../../fixtures';

const GROUP_NAMES = ['Bulk Delete 1', 'Bulk Delete 2'];

test.describe('Groups Management', () => {
  test('Bulk Delete Groups', async ({ casterAuthenticatedPage: page }) => {

    await gotoCasterGroupsAdmin(page);

    // 1. Create multiple groups
    for (const groupName of GROUP_NAMES) {
      await createCasterGroup(page, groupName);
      await expect(casterGroupCell(page, groupName)).toBeVisible();
    }

    // 2. Delete each group individually (no bulk delete UI with checkboxes available)
    for (const groupName of GROUP_NAMES) {
      await deleteCasterGroup(page, groupName);
      await expect(casterGroupCell(page, groupName)).toHaveCount(0);
    }
  });
});
