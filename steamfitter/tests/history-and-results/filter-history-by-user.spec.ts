// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import {
  seedHistoryData,
  cleanupHistorySeedData,
  navigateToHistory,
  HistorySeedData,
} from './history-helpers';

test.describe('History and Results', () => {
  let seedData: HistorySeedData | null = null;

  test.afterEach(async ({ steamfitterApi }) => {
    await cleanupHistorySeedData(steamfitterApi, seedData);
    seedData = null;
  });

  test('Filter History by User', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    seedData = await seedHistoryData(steamfitterApi);

    await navigateToHistory(page);

    // Default category is "User" - the Users dropdown should be visible
    const usersSelect = page.getByLabel('Users');
    await expect(usersSelect).toBeVisible({ timeout: 5000 });

    // Open the Users dropdown and select the first user
    await usersSelect.click();
    const userOption = page.getByRole('option').first();
    await expect(userOption).toBeVisible({ timeout: 5000 });
    await userOption.click();

    // Verify the history table appears with results
    const table = page.locator('table[mat-table]');
    await expect(table).toBeVisible({ timeout: 10000 });

    const rows = page.locator('tr.element-row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });
});
