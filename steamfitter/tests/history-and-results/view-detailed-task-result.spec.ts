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

  test('View Detailed Task Result', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    seedData = await seedHistoryData(steamfitterApi);

    await navigateToHistory(page);
    await selectHistoryUser(page);

    // Wait for results to load
    const table = page.locator('table[mat-table]');
    await expect(table).toBeVisible({ timeout: 10000 });

    const rows = page.locator('tr.element-row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Click on the first result row to expand its detail view
    await rows.first().click();

    // Verify the expanded detail row shows expected fields
    // Multiple .result-details elements exist in the DOM (one per row), but only the
    // clicked row's detail is expanded/visible. Use .first() to target the visible one.
    const detailRow = page.locator('.result-details').first();
    await expect(detailRow).toBeVisible({ timeout: 5000 });
    await expect(detailRow).toContainText('vmName:');
    await expect(detailRow).toContainText('status:');
    await expect(detailRow).toContainText('actualOutput:');
    await expect(detailRow).toContainText('expectedOutput:');
  });
});
