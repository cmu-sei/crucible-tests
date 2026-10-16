// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import type { Page } from '@playwright/test';
import { test, expect, expectCasterProjectOpen, CASTER_THEMES, setCasterTheme } from '../../fixtures';

/**
 * Create a project from the home page and return to the home page.
 *
 * Saving navigates into the new project, so callers that want to keep working
 * with the project list have to come back — this keeps that round trip in one
 * place. The new ID is registered for cleanup as soon as the POST returns, so a
 * failure later in the round trip cannot leak the project.
 */
async function createProject(
  page: Page,
  name: string,
  registerCleanup: (projectId: string) => void,
): Promise<void> {
  await page.locator('button[mattooltip="Add New Project"]').click();
  await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Name' }).fill(name);

  const createResponsePromise = page.waitForResponse(resp =>
    resp.url().includes('/api/projects') && resp.request().method() === 'POST' && resp.ok()
  );
  await page.getByRole('button', { name: 'Save' }).click();
  registerCleanup((await (await createResponsePromise).json()).id);

  await expectCasterProjectOpen(page, name);
  await page.getByRole('link', { name: 'Caster', exact: true }).click();
}

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
    test('Search and Filter Projects', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
      await setCasterTheme(page, theme);
      // Two projects, because filtering can only be proven by what it *excludes*.
      // Both are seeded by this test rather than assumed to exist. "My Projects" is
      // paginated and sorted by name, and other projects may already be listed, so
      // every assertion about a specific row runs against a filtered list — never
      // against whatever happens to land on page 1.
      const stamp = Date.now();
      const matchingName = `Searchable Project ${stamp}`;
      const otherName = `Unrelated Project ${stamp}`;

      // 1. Navigate to Projects section
      await expect(page.getByText('My Projects')).toBeVisible();

      await createProject(page, matchingName, cleanupCasterProject);
      await createProject(page, otherName, cleanupCasterProject);

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
      await search(page, String(stamp));
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
