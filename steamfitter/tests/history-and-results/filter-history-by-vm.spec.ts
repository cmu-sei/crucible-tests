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

  // Filtering by VM requires VMs returned by the Player VM API. This test
  // verifies the Category dropdown switches to "VM" and the VMs dropdown appears.
  // If no VMs exist in the environment, the dropdown will be empty.
  test('Filter History by VM', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    seedData = await seedHistoryData(steamfitterApi);

    await navigateToHistory(page);

    // Change Category to "VM"
    const categorySelect = page.getByLabel('Category');
    await expect(categorySelect).toBeVisible({ timeout: 5000 });
    await categorySelect.click();
    await page.getByRole('option', { name: 'VM' }).click();

    // The "VMs" dropdown should become visible
    const vmsSelect = page.getByLabel('VMs');
    await expect(vmsSelect).toBeVisible({ timeout: 5000 });

    // Check if there are any VMs available
    await vmsSelect.click();
    const vmOptions = page.getByRole('option');
    const optionCount = await vmOptions.count();

    if (optionCount > 0) {
      // Select the first VM
      await vmOptions.first().click();

      // The history table may or may not show results depending on whether
      // the VM has associated results
      const table = page.locator('table[mat-table]');
      await expect(table).toBeVisible({ timeout: 10000 });
    } else {
      // No VMs available - close the dropdown by pressing Escape
      await page.keyboard.press('Escape');
    }
  });
});
