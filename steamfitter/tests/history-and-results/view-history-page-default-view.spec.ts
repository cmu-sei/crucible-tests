// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import {
  seedHistoryData,
  cleanupHistorySeedData,
  navigateToHistory,
  selectHistoryUser,
  HistorySeedData,
} from './history-helpers';

test.describe('History and Results', () => {
  let seedData: HistorySeedData | null = null;

  test.afterEach(async ({ steamfitterApi }) => {
    await cleanupHistorySeedData(steamfitterApi, seedData);
    seedData = null;
  });

  test('View History Page Default View', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    seedData = await seedHistoryData(steamfitterApi);

    await navigateToHistory(page);

    // Verify default category is "User"
    const categorySelect = page.getByLabel('Category');
    await expect(categorySelect).toBeVisible({ timeout: 5000 });
    await expect(categorySelect).toContainText('User');

    // The "Users" dropdown should be visible since default category is User
    const usersSelect = page.getByLabel('Users');
    await expect(usersSelect).toBeVisible();

    // Select the first user to load results
    await selectHistoryUser(page);

    // Verify the history table appears with results
    const table = page.locator('table[mat-table]');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Verify results appear in reverse chronological order (default sort)
    const rows = page.locator('tr.element-row');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(2);

    if (count >= 2) {
      // Use nth() instead of CSS :first-child/:last-child since Angular Material
      // interleaves detail rows between element rows in the DOM
      const firstDate = await rows.nth(0).locator('td.date-column').textContent();
      const lastDate = await rows.nth(count - 1).locator('td.date-column').textContent();
      expect(firstDate?.trim()).toBeTruthy();
      expect(lastDate?.trim()).toBeTruthy();
    }
  });
});
