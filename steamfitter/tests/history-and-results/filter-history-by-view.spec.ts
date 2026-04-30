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

  // Filtering by View requires a scenario associated with a Player View, which
  // in turn requires a running Player API with views. This test verifies the
  // Category dropdown switches to "View" and the Views dropdown appears.
  // If no views exist in the environment, the dropdown will be empty.
  test('Filter History by View', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    seedData = await seedHistoryData(steamfitterApi);

    await navigateToHistory(page);

    // Change Category to "View"
    const categorySelect = page.getByLabel('Category');
    await expect(categorySelect).toBeVisible({ timeout: 5000 });
    await categorySelect.click();
    await page.getByRole('option', { name: 'View' }).click();

    // The "Views" dropdown should become visible
    const viewsSelect = page.getByLabel('Views');
    await expect(viewsSelect).toBeVisible({ timeout: 5000 });

    // Check if there are any views available
    await viewsSelect.click();
    const viewOptions = page.getByRole('option');
    const optionCount = await viewOptions.count();

    if (optionCount > 0) {
      // Select the first view
      await viewOptions.first().click();

      // The history table may or may not show results depending on whether
      // the seeded scenario is linked to this view
      const table = page.locator('table[mat-table]');
      await expect(table).toBeVisible({ timeout: 10000 });
    } else {
      // No views available - close the dropdown by pressing Escape
      await page.keyboard.press('Escape');
    }
  });
});
