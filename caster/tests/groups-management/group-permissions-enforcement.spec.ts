// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Groups Management', () => {
  test('Group Permissions Enforcement', async ({ casterAuthenticatedPage: page }) => {

    await page.goto(Services.Caster.UI + '/admin?section=Groups');

    await expect(page.getByRole('columnheader', { name: 'Group Name' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search Groups' })).toBeVisible();

    // expect: As admin, create group button is available
    const createButton = page.getByRole('table').getByRole('button').first();
    await expect(createButton).toBeVisible();
  });
});
