// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Groups Management', () => {
  test('View Groups List', async ({ casterAuthenticatedPage: page }) => {

    // 1. Navigate to Admin section and click on Groups in the sidebar
    await page.goto(Services.Caster.UI + '/admin?section=Groups');

    // expect: Groups page loads
    await expect(page).toHaveURL(/section=Groups/);

    // expect: Groups table is displayed with columns: selection checkbox, Group Name
    await expect(page.getByRole('columnheader', { name: 'Group Name' })).toBeVisible({ timeout: 10000 });

    // expect: Search Groups textbox is available at the top
    await expect(page.getByRole('textbox', { name: 'Search Groups' })).toBeVisible();

    // expect: Create group button is visible
    const createButton = page.getByRole('table').getByRole('button').first();
    await expect(createButton).toBeVisible();
  });
});
