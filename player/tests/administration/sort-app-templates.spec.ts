// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Application Templates', () => {
  test('Sort Application Templates', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Application Templates
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Application Templates' }).click();

    // expect: The Application Templates section is displayed
    const nameHeader = page.getByRole('columnheader', { name: 'Name' });
    await expect(nameHeader).toBeVisible();
    const getSortState = async (header = nameHeader) => (await header.getAttribute('aria-sort')) ?? 'none';
    const nextSortState = (state: string) =>
      state === 'ascending' ? 'descending' : state === 'descending' ? 'none' : 'ascending';

    // 2. Click the 'Name' column header to sort
    const initialNameState = await getSortState(nameHeader);
    await nameHeader.click();
    const afterFirstNameClick = nextSortState(initialNameState);
    await expect.poll(() => getSortState(nameHeader)).toBe(afterFirstNameClick);
    await nameHeader.click();
    await expect.poll(() => getSortState(nameHeader)).toBe(nextSortState(afterFirstNameClick));

    // 3. Click the 'Url' column header
    const urlHeader = page.getByRole('columnheader', { name: 'Url' });
    const initialUrlState = await getSortState(urlHeader);
    await urlHeader.click();

    // expect: Templates are sorted by URL
    await expect.poll(() => getSortState(urlHeader)).toBe(nextSortState(initialUrlState));
  });
});
