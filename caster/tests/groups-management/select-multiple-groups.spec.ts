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

const GROUP_NAMES = ['Select Group 1', 'Select Group 2'];

test.describe('Groups Management', () => {
  test('Select Multiple Groups', async ({ casterAuthenticatedPage: page }) => {

    await gotoCasterGroupsAdmin(page);

    // 1. Create two groups for selection testing
    for (const groupName of GROUP_NAMES) {
      await createCasterGroup(page, groupName);
      await expect(casterGroupCell(page, groupName)).toBeVisible();
    }

    // 2. Click on group rows to expand/select them
    for (const groupName of GROUP_NAMES) {
      const row = page.getByRole('row').filter({ has: casterGroupCell(page, groupName) });
      await row.getByRole('cell').last().click();
    }

    // Cleanup: reload to clear any expanded rows and error overlays, then delete groups
    await gotoCasterGroupsAdmin(page);

    for (const groupName of GROUP_NAMES) {
      await expect(casterGroupCell(page, groupName)).toBeVisible({ timeout: 10000 });
      await deleteCasterGroup(page, groupName);
    }

    // Final verification: neither group exists
    for (const groupName of GROUP_NAMES) {
      await expect(casterGroupCell(page, groupName)).toHaveCount(0);
    }
  });
});
