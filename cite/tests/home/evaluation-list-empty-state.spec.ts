// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Home Page and Evaluation List', () => {
  test('Evaluation List Display - Empty State', async ({ citeAuthenticatedPage: page }) => {

    // 1. Log in as user with no evaluations assigned
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });

    // expect: Evaluation list is empty or shows 'No results found' message
    // Note: This test verifies the empty state handling. If evaluations exist,
    // we filter to produce an empty result.
    const searchField = page.locator('input[type="text"], input[placeholder*="search"], input[placeholder*="filter"], mat-form-field input').first();

    // Type a search term that won't match any evaluation
    if (await searchField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchField.fill('zzz_nonexistent_evaluation_xyz');

      // expect: No evaluations are displayed in the table
      const noResults = page.locator('text=No results, text=No evaluations, text=no data, td:has-text("No")').first();
      const emptyRows = page.locator('mat-row, tbody tr');

      // Either a "no results" message appears or the row count is zero
      const hasNoResultsMessage = await noResults.isVisible({ timeout: 5000 }).catch(() => false);
      if (!hasNoResultsMessage) {
        await expect(emptyRows).toHaveCount(0, { timeout: 5000 });
      }
    }
  });
});
