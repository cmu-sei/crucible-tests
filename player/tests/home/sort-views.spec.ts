// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, seededPrimaryViewName, seededSteamfitterViewName } from '../../fixtures';

test.describe('Home Page - My Views', () => {
  test('Sort Views by Name', async ({ playerAuthenticatedPage: page }) => {
    const primaryViewName = seededPrimaryViewName();
    const steamfitterViewName = seededSteamfitterViewName();

    // 1. Log in as admin user
    // expect: User is on the home page with multiple views displayed
    await expect(page.getByText('My Views')).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    const nameHeader = page.getByRole('columnheader', { name: 'Name' });
    const getSortState = async () => (await nameHeader.getAttribute('aria-sort')) ?? 'none';
    const getVisibleNames = async () =>
      (await page.getByRole('row').locator('[role="cell"]:first-child').allTextContents())
        .map((name) => name.trim())
        .filter((name) => name.length > 0);
    const getRelativeOrder = async () => {
      const visibleNames = await getVisibleNames();
      const primaryIndex = visibleNames.indexOf(primaryViewName);
      const steamfitterIndex = visibleNames.indexOf(steamfitterViewName);

      expect(primaryIndex).toBeGreaterThanOrEqual(0);
      expect(steamfitterIndex).toBeGreaterThanOrEqual(0);

      return Math.sign(primaryIndex - steamfitterIndex);
    };

    // 2. The table starts sorted by Name ascending
    await expect.poll(getSortState).toBe('ascending');
    const ascendingOrder = await getRelativeOrder();

    // 3. First click toggles to descending
    await nameHeader.click();
    await expect.poll(getSortState).toBe('descending');
    const descendingOrder = await getRelativeOrder();
    expect(descendingOrder).toBe(-ascendingOrder);

    // 4. Second click toggles to unsorted/none
    await nameHeader.click();
    await expect.poll(getSortState).toBe('none');

    // 5. Third click returns to ascending
    await nameHeader.click();
    await expect.poll(getSortState).toBe('ascending');
    const restoredAscendingOrder = await getRelativeOrder();
    expect(restoredAscendingOrder).toBe(ascendingOrder);
  });
});
