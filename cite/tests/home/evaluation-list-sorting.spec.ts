// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, serviceUrlPattern, loadCiteSeedIds, CITE_THEMES, setCiteTheme } from '../../fixtures';

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Home Page and Evaluation List`, () => {
    test('Evaluation List Sorting', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      // 1. Two evaluations to sort: the run-level shared read-only pair (global-setup),
      //    both with Admin User on a team. Sorting only reads them.
      await loadCiteSeedIds();

      // 2. Navigate to home page
      await page.goto(Services.Cite.UI);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(serviceUrlPattern(Services.Cite.UI), { timeout: 10000 });

      const myEvalsHeading = page.locator('text=My Evaluations');
      await expect(myEvalsHeading).toBeVisible({ timeout: 10000 });

      // 3. Wait for evaluation rows to load
      const rows = page.locator('mat-row, tbody tr').filter({ hasNot: page.locator('th') });
      await expect(rows.first()).toBeVisible({ timeout: 15000 });

      // 4. Click on the 'Name' column header to sort ascending
      const nameHeader = page.locator('th:has-text("Name"), mat-header-cell:has-text("Name"), [mat-sort-header]:has-text("Name")').first();
      await nameHeader.click();

      // Verify sort indicator appears
      const sortIndicator = nameHeader.locator('.mat-sort-header-arrow, mat-sort-header-arrow');
      await expect(sortIndicator).toBeVisible({ timeout: 5000 });

      // 5. Click again to sort descending
      await nameHeader.click();
      // Wait for sort direction to change to descending (Angular Material sets aria-sort attribute)
      await expect(nameHeader).toHaveAttribute('aria-sort', 'descending', { timeout: 5000 });
    });
  });
}
