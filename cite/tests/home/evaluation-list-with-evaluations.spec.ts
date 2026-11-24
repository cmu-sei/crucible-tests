// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import {
  test,
  expect,
  Services,
  serviceUrlPattern,
  loadCiteSeedIds,
  CITE_THEMES,
  setCiteTheme,
  SHARED_READ_ONLY_EVALUATION,
  SHARED_BETA_EVALUATION,
} from '../../fixtures';

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Home Page and Evaluation List`, () => {
    test('Evaluation List Display - With Evaluations', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      // 1. The run-level shared evaluations (global-setup) have Admin User on a team, so
      //    My Evaluations lists them; this test only reads the list.
      await loadCiteSeedIds();

      // 2. Navigate to home page
      await page.goto(Services.Cite.UI);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(serviceUrlPattern(Services.Cite.UI), { timeout: 10000 });

      const myEvalsHeading = page.locator('text=My Evaluations');
      await expect(myEvalsHeading).toBeVisible({ timeout: 10000 });

      // 3. Verify evaluation list table displays
      const table = page.locator('mat-table, table, [class*="evaluation-list"]').first();
      await expect(table).toBeVisible({ timeout: 15000 });

      // 4. Verify table shows expected columns
      const nameColumn = page.locator('th:has-text("Name"), mat-header-cell:has-text("Name"), [class*="header"]:has-text("Name")').first();
      await expect(nameColumn).toBeVisible({ timeout: 5000 });

      const statusColumn = page.locator('th:has-text("Status"), mat-header-cell:has-text("Status"), [class*="header"]:has-text("Status")').first();
      await expect(statusColumn).toBeVisible({ timeout: 5000 });

      // 5. Verify both shared evaluations are listed. Checking for any row is not enough:
      //    the admin may belong to other evaluations, so the list can be non-empty even
      //    when the seeded membership went to someone else.
      const rows = page.locator('mat-row, tbody tr').filter({ hasNot: page.locator('th') });
      for (const name of [SHARED_READ_ONLY_EVALUATION, SHARED_BETA_EVALUATION]) {
        await expect(rows.filter({ hasText: name }), `${name} is in My Evaluations`).toHaveCount(1, { timeout: 15000 });
      }
    });
  });
}
