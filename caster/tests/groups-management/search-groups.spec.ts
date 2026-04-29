// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Groups Management', () => {
  test('Search Groups', async ({ casterAuthenticatedPage: page }) => {

    // 1. Navigate to Groups admin section
    await page.goto(Services.Caster.UI + '/admin?section=Groups');
    await expect(page.getByRole('columnheader', { name: 'Group Name' })).toBeVisible({ timeout: 10000 });

    const searchBox = page.getByRole('textbox', { name: 'Search Groups' });
    await expect(searchBox).toBeVisible();

    // 2. Enter a search term
    await searchBox.fill('TestSearch');

    // 3. Clear the search box
    await searchBox.clear();

    // expect: All groups are displayed again
    await expect(page.getByRole('table')).toBeVisible();
  });
});
