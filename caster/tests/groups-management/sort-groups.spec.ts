// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Groups Management', () => {
  test('Sort Groups', async ({ casterAuthenticatedPage: page }) => {

    await page.goto(Services.Caster.UI + '/admin?section=Groups');
    await expect(page.getByRole('columnheader', { name: 'Group Name' })).toBeVisible({ timeout: 10000 });

    // 2. Click on the Group Name column header
    await page.getByRole('button', { name: 'Group Name' }).click();

    // 3. Click on the Group Name column header again
    await page.getByRole('button', { name: 'Group Name' }).click();
    await expect(page.getByRole('button', { name: 'Group Name' })).toBeVisible();
  });
});
