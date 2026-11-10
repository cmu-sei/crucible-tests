// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, serviceUrlPattern, loadCiteSeedIds, SHARED_READ_ONLY_EVALUATION, SHARED_BETA_EVALUATION, CITE_THEMES, setCiteTheme } from '../../fixtures';

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Home Page and Evaluation List`, () => {
    test('Evaluation List Search/Filter', async ({ citeAuthenticatedPage: page }) => {
      // Two evaluations to filter between: the run-level shared pair (global-setup),
      // both with Admin User on their team, so both are in "My Evaluations". Only read.
      await loadCiteSeedIds();
      await setCiteTheme(page, theme);

      // 1. Home page with the "My Evaluations" list loaded.
      await expect(page).toHaveURL(serviceUrlPattern(Services.Cite.UI));
      const list = page.locator('.evaluation-list-container');
      await expect(list.getByText('My Evaluations', { exact: true })).toBeVisible();
      const rows = list.locator('mat-row');
      const readOnlyRow = rows.filter({ hasText: SHARED_READ_ONLY_EVALUATION });
      const betaRow = rows.filter({ hasText: SHARED_BETA_EVALUATION });

      // The list pages at 10 by default and other evaluations can sort between the two,
      // so show 100 per page to keep both on page 1 regardless of what else exists.
      // The paginator's touch-target overlay intercepts a pointer click on the select,
      // so open it from the keyboard.
      const pageSize = list.getByRole('combobox', { name: 'Items per page:' });
      await pageSize.focus();
      await pageSize.press('Enter');
      await page.getByRole('option', { name: '100', exact: true }).click();

      // expect: the list displays both evaluations.
      await expect(readOnlyRow).toHaveCount(1);
      await expect(betaRow).toHaveCount(1);

      // 2. The search field.
      const searchField = list.getByPlaceholder('Search');
      await expect(searchField).toBeVisible();

      // 3. Filter on one evaluation's name. The home page filters on keyup, so type it.
      await searchField.pressSequentially(SHARED_READ_ONLY_EVALUATION);

      // expect: the matching row stays (positive signal), the other is hidden.
      await expect(readOnlyRow).toHaveCount(1);
      await expect(betaRow).toHaveCount(0);

      // 4. Clear the search with the field's clear button.
      await list.getByRole('button', { name: 'Clear Search' }).click();

      // expect: the field is empty and both evaluations are displayed again.
      await expect(searchField).toHaveValue('');
      await expect(readOnlyRow).toHaveCount(1);
      await expect(betaRow).toHaveCount(1);
    });
  });
}
