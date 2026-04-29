// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Roles and Permissions Management', () => {
  test('Assign and Revoke Permissions', async ({ casterAuthenticatedPage: page }) => {

    // 1. Navigate to Roles admin section
    await page.goto(Services.Caster.UI + '/admin?section=Roles');

    // expect: Permissions matrix shows roles
    await expect(page.getByRole('columnheader', { name: 'Content Developer' })).toBeVisible({ timeout: 10000 });

    // Helper: locate the Content Developer / ViewProjects checkbox fresh each time.
    // The table DOM is replaced after every permission change, so locators must not be cached.
    const getCheckbox = async () => {
      const headerRow = page.getByRole('row').first();
      const headers = headerRow.getByRole('columnheader');
      const headerCount = await headers.count();
      let cdCol = -1;
      for (let i = 0; i < headerCount; i++) {
        const text = await headers.nth(i).innerText();
        const trimmed = text.trim().split('\n')[0].trim();
        if (trimmed === 'Content Developer') { cdCol = i; break; }
      }
      const viewProjectsRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'ViewProjects', exact: true }) });
      return viewProjectsRow.getByRole('cell').nth(cdCol).getByRole('checkbox');
    };

    // 2. Click on the ViewProjects permission checkbox for Content Developer
    const wasChecked = await (await getCheckbox()).isChecked();
    await (await getCheckbox()).click();

    // expect: Checkbox state changes
    if (wasChecked) {
      await expect(await getCheckbox()).not.toBeChecked();
    } else {
      await expect(await getCheckbox()).toBeChecked();
    }

    // 3. Click the checkbox again to toggle back
    await (await getCheckbox()).click();

    // expect: Checkbox reverts to original state
    if (wasChecked) {
      await expect(await getCheckbox()).toBeChecked();
    } else {
      await expect(await getCheckbox()).not.toBeChecked();
    }
  });
});
