// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Views', () => {
  test('Sort Views in Admin', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Views
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // expect: The Views admin section displays multiple views
    await expect(page.getByRole('heading', { name: 'Views' })).toBeVisible();

    const nameHeader = page.getByRole('columnheader', { name: 'Name' });
    const getSortState = async (header = nameHeader) => (await header.getAttribute('aria-sort')) ?? 'none';
    const nextSortState = (state: string) =>
      state === 'ascending' ? 'descending' : state === 'descending' ? 'none' : 'ascending';

    // 2. Click the 'Name' column header to sort
    const initialNameState = await getSortState(nameHeader);
    await nameHeader.click();
    const afterFirstNameClick = nextSortState(initialNameState);
    await expect.poll(() => getSortState(nameHeader)).toBe(afterFirstNameClick);
    await nameHeader.click();
    const afterSecondNameClick = nextSortState(afterFirstNameClick);
    await expect.poll(() => getSortState(nameHeader)).toBe(afterSecondNameClick);
    await nameHeader.click();
    await expect.poll(() => getSortState(nameHeader)).toBe(nextSortState(afterSecondNameClick));

    // 3. Click the 'Status' column header
    const statusHeader = page.getByRole('columnheader', { name: 'Status' });
    const initialStatusState = await getSortState(statusHeader);
    await statusHeader.click();

    // expect: Views are sorted by status
    await expect.poll(() => getSortState(statusHeader)).toBe(nextSortState(initialStatusState));
  });
});
