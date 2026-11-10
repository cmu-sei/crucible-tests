// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import type { Page } from '@playwright/test';
import {
  test,
  expect,
  CASTER_THEMES,
  setCasterTheme,
  seedCasterProjectPageFree,
  deleteCasterProjectPageFree,
} from '../../fixtures';

let matchingProjectId: string;
let otherProjectId: string;
const stamp = 'search-and-filter-projects';
const matchingName = `E2E Searchable Project [${stamp}]`;
const otherName = `E2E Unrelated Project [${stamp}]`;

test.beforeAll(async () => {
  matchingProjectId = await seedCasterProjectPageFree(matchingName);
  otherProjectId = await seedCasterProjectPageFree(otherName);
});

test.afterAll(async () => {
  await deleteCasterProjectPageFree(matchingProjectId);
  await deleteCasterProjectPageFree(otherProjectId);
});

/**
 * Type into the project search box. The list filters on keyup, so `fill()`
 * alone does not apply the filter; pressing End fires the keyup without
 * changing the text.
 */
async function search(page: Page, term: string): Promise<void> {
  const searchBox = page.getByRole('textbox', { name: 'Search' });
  await searchBox.fill(term);
  await searchBox.press('End');
}

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Projects Management`, () => {
    test('Search and Filter Projects', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      // 1. Navigate to Projects section
      await expect(page.getByText('My Projects')).toBeVisible();

      const searchBox = page.getByRole('textbox', { name: 'Search' });
      const matchingRow = page.getByRole('link', { name: matchingName, exact: true });
      const otherRow = page.getByRole('link', { name: otherName, exact: true });
      // mat-paginator's range label reads "1 – 10 of 42"; the total is the size of
      // the (filtered) list, whichever page is shown.
      const rangeLabel = page.locator('.mat-mdc-paginator-range-label');
      await expect(rangeLabel).toHaveText(/of \d+/);
      const unfilteredLabel = (await rangeLabel.textContent())!.trim();

      // expect: Projects list is visible with multiple projects. The shared stamp
      // narrows the list to exactly this test's two projects.
      await search(page, stamp);
      await expect(matchingRow).toBeVisible();
      await expect(otherRow).toBeVisible();
      await expect(page.getByRole('row')).toHaveCount(3); // header + 2 projects

      // 2. Enter a search term in the search box
      await search(page, matchingName);

      // expect: The list filters to show only projects matching the search term
      await expect(matchingRow).toBeVisible();
      await expect(otherRow).not.toBeVisible();
      await expect(page.getByRole('row')).toHaveCount(2);

      // 3. Clear the search box
      await search(page, '');

      // expect: All projects are displayed again — the full list's total is back
      await expect(searchBox).toHaveValue('');
      await expect(page.getByText(/No data matching the filter/)).not.toBeVisible();
      await expect(rangeLabel).toHaveText(unfilteredLabel);
    });
  });
}
