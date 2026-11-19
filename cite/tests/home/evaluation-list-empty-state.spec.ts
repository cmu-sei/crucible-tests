// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { randomUUID } from 'node:crypto';
import { test, expect, Services, serviceUrlPattern, loadCiteSeedIds, SHARED_READ_ONLY_EVALUATION, CITE_THEMES, setCiteTheme } from '../../fixtures';

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Home Page and Evaluation List`, () => {
    test('Evaluation List Display - Empty State', async ({ citeAuthenticatedPage: page }) => {
      // The run-level shared evaluations (global-setup) guarantee the list starts
      // non-empty, so the empty state below is produced by the filter, not by chance.
      // Only read.
      await loadCiteSeedIds();
      await setCiteTheme(page, theme);

      // 1. Home page with the "My Evaluations" list loaded.
      await expect(page).toHaveURL(serviceUrlPattern(Services.Cite.UI));
      const list = page.locator('.evaluation-list-container');
      await expect(list.getByText('My Evaluations', { exact: true })).toBeVisible();
      const rows = list.locator('mat-row');
      await expect(rows.filter({ hasText: SHARED_READ_ONLY_EVALUATION })).toHaveCount(1);

      // 2. Filter on a term no evaluation can contain. The home page filters the table's
      //    data source on keyup (home-app.component.html), so type rather than fill.
      const searchField = list.getByPlaceholder('Search');
      await expect(searchField).toBeVisible();
      await searchField.pressSequentially(`zzz-no-such-evaluation-${randomUUID()}`);

      // expect: the "No results found" message (rendered when filteredData is empty) —
      // the positive signal — and then no evaluation rows.
      await expect(list.locator('.no-results')).toHaveText('No results found');
      await expect(rows).toHaveCount(0);
    });
  });
}
