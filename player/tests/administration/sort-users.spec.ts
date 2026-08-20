// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Users', () => {
  test('Sort Users', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Users
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Users Users' }).click();

    // expect: The Users section is displayed
    await expect(page.getByRole('columnheader', { name: 'ID' })).toBeVisible();
    const idHeader = page.getByRole('columnheader', { name: 'ID' });
    const nameHeader = page.getByRole('columnheader', { name: 'Name' });
    const getSortState = async (header: typeof idHeader) => (await header.getAttribute('aria-sort')) ?? 'none';
    const nextSortState = (state: string) =>
      state === 'ascending' ? 'descending' : state === 'descending' ? 'none' : 'ascending';

    // 2. Click the 'ID' column header
    const initialIdState = await getSortState(idHeader);
    await idHeader.click();

    // expect: Users are sorted by ID
    await expect.poll(() => getSortState(idHeader)).toBe(nextSortState(initialIdState));

    // 3. Click the 'Name' column header
    const initialNameState = await getSortState(nameHeader);
    await nameHeader.click();

    // expect: Users are sorted by name
    await expect.poll(() => getSortState(nameHeader)).toBe(nextSortState(initialNameState));
    await expect.poll(() => getSortState(idHeader)).toBe('none');
  });
});
