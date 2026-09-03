// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  createUnit,
  deleteUnit,
  tempBlueprintName,
} from '../../test-helpers';

test.describe('Admin - Units Management', () => {
  test('Search and Filter Units', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();
    const matchingName = tempBlueprintName('SearchMatch');
    const nonMatchingName = tempBlueprintName('ZZNonMatch');
    let matchingId: string | undefined;
    let nonMatchingId: string | undefined;

    try {
      // Seed two units: one with a searchable term, one without
      const match = await createUnit(token, { name: matchingName, shortName: 'SM' });
      matchingId = match.id;
      const nonMatch = await createUnit(token, { name: nonMatchingName, shortName: 'NM' });
      nonMatchingId = nonMatch.id;

      // Navigate to Admin → Units
      await page.goto(`${Services.Blueprint.UI}/admin`);
      const unitsNav = page.locator('mat-list-item').filter({ hasText: 'Units' }).first();
      await expect(unitsNav).toBeVisible({ timeout: 10000 });
      await unitsNav.click();

      // Wait for the table to be visible
      const unitsTable = page.locator('table').first();
      await expect(unitsTable).toBeVisible({ timeout: 5000 });

      const searchInput = page.getByRole('textbox', { name: /search/i });
      await expect(searchInput).toBeVisible({ timeout: 5000 });

      // Both units should be visible before filtering
      await expect(page.getByRole('cell', { name: matchingName, exact: true }).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('cell', { name: nonMatchingName, exact: true }).first()).toBeVisible({ timeout: 5000 });

      // Type the term rather than fill() it: this search filters on (keyup), so setting the
      // value directly never triggers filtering and the "excluded" assertion below would fail
      // while the feature works. (Same gotcha noted for the Alloy home-page search.)
      await searchInput.click();
      await searchInput.pressSequentially('SearchMatch');

      // expect: Table filters to show only matching units
      await expect(page.getByRole('cell', { name: matchingName, exact: true }).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('cell', { name: nonMatchingName, exact: true }).first()).not.toBeVisible({ timeout: 3000 });

      // Clear the search — again via keyboard so the keyup handler runs.
      await searchInput.click();
      await searchInput.press('Control+a');
      await searchInput.press('Backspace');

      // expect: All units are displayed again
      await expect(page.getByRole('cell', { name: matchingName, exact: true }).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('cell', { name: nonMatchingName, exact: true }).first()).toBeVisible({ timeout: 5000 });
    } finally {
      // Cleanup via API
      if (matchingId) await deleteUnit(token, matchingId);
      if (nonMatchingId) await deleteUnit(token, nonMatchingId);
    }
  });
});
