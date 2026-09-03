// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  tempBlueprintName,
} from '../../test-helpers';

test.describe('MSEL Management', () => {
  test('Search and Filter MSELs', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();

    // 1. Seed two MSELs with distinct names and statuses
    const searchableName = tempBlueprintName('SearchMe');
    const otherName = tempBlueprintName('OtherMSEL');

    const searchableMsel = await createMsel(token, {
      name: searchableName,
      description: 'MSEL for search test with unique keyword SearchMe',
      status: 'Pending',
    });

    const otherMsel = await createMsel(token, {
      name: otherName,
      description: 'Another MSEL without the search keyword',
      status: 'Approved',
    });

    try {
      // 2. Navigate to MSELs list
      await page.goto(`${Services.Blueprint.UI}/build`);
      await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });

      // 3. Test search functionality
      const searchBox = page.getByRole('textbox', { name: 'Search' });
      await expect(searchBox).toBeVisible();

      // Search for the unique keyword
      await searchBox.fill('SearchMe');

      // expect: Only the searchable MSEL appears
      const searchableRow = page.getByRole('row').filter({ hasText: searchableName });
      await expect(searchableRow).toBeVisible({ timeout: 10000 });

      const otherRow = page.getByRole('row').filter({ hasText: otherName });
      await expect(otherRow).not.toBeVisible({ timeout: 5000 });

      // 4. Clear search
      await searchBox.clear();
      await searchBox.fill(''); // Ensure it's completely cleared

      // Wait for the search to process and show all rows
      // Use the searchable name to check it's back
      await searchBox.fill(searchableName);
      await expect(page.getByRole('row').filter({ hasText: searchableName })).toBeVisible({ timeout: 10000 });

      // Clear again and check the other name
      await searchBox.clear();
      await searchBox.fill(otherName);
      await expect(page.getByRole('row').filter({ hasText: otherName })).toBeVisible({ timeout: 10000 });

      // Clear for the next test step
      await searchBox.clear();

      // 5. Test status filter
      const statusFilter = page.getByRole('combobox', { name: /All Statuses/i });
      await expect(statusFilter).toBeVisible();
      await statusFilter.click();

      const pendingOption = page.getByRole('option', { name: 'Pending' });
      await expect(pendingOption).toBeVisible();
      await pendingOption.click();

      // expect: Only the Pending MSEL appears
      await searchBox.fill(searchableName);
      const pendingRow = page.getByRole('row').filter({ hasText: searchableName });
      await expect(pendingRow).toBeVisible({ timeout: 10000 });

      // The Approved MSEL should not appear in the Pending filter
      await searchBox.clear();
      await searchBox.fill(otherName);
      const approvedRow = page.getByRole('row').filter({ hasText: otherName });
      const isApprovedVisible = await approvedRow.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isApprovedVisible).toBe(false);
    } finally {
      // 7. Clean up: delete both MSELs
      await deleteMsel(token, searchableMsel.id);
      await deleteMsel(token, otherMsel.id);
    }
  });
});
