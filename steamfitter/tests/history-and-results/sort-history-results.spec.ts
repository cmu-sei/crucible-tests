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

  test('Sort History Results', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    seedData = await seedHistoryData(steamfitterApi);

    await navigateToHistory(page);
    await selectHistoryUser(page);

    // Wait for results to load
    const table = page.locator('table[mat-table]');
    await expect(table).toBeVisible({ timeout: 10000 });

    const rows = page.locator('tr.element-row');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(2);

    // Capture the first row text before sorting
    const initialFirstRow = await rows.first().textContent();

    // Click the "Date" column header to change sort order (default is desc, clicking toggles to asc)
    const dateHeader = page.locator('th[mat-sort-header]').filter({ hasText: 'Date' });
    await dateHeader.click();

    // After sorting, the first row content should change since data has different dates
    await expect(async () => {
      const sortedFirstRow = await rows.first().textContent();
      expect(sortedFirstRow).not.toEqual(initialFirstRow);
    }).toPass({ timeout: 5000 });
  });
});
