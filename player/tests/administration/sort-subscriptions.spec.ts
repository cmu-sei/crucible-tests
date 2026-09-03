// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Subscriptions', () => {
  test('Sort Subscriptions', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Subscriptions
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Subscriptions Subscriptions' }).click();

    // expect: The Subscriptions section is displayed
    const nameHeader = page.getByRole('columnheader', { name: 'Name' });
    await expect(nameHeader).toBeVisible();
    const eventTypesHeader = page.getByRole('columnheader', { name: 'Event Types' });
    const getSortState = async (header = nameHeader) => (await header.getAttribute('aria-sort')) ?? 'none';
    const nextSortState = (state: string) =>
      state === 'ascending' ? 'descending' : state === 'descending' ? 'none' : 'ascending';

    // 2. Click the 'Name' column header
    const initialNameState = await getSortState(nameHeader);
    await nameHeader.click();

    // expect: Subscriptions are sorted by name
    await expect.poll(() => getSortState(nameHeader)).toBe(nextSortState(initialNameState));

    // 3. Click the 'Event Types' column header
    const initialEventTypesState = await getSortState(eventTypesHeader);
    await eventTypesHeader.click();

    // expect: Subscriptions are sorted by event types
    await expect.poll(() => getSortState(eventTypesHeader)).toBe(nextSortState(initialEventTypesState));
    await expect.poll(() => getSortState(nameHeader)).toBe('none');
  });
});
