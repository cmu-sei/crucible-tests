// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, serviceUrlPattern, loadCiteSeedIds, CITE_THEMES, setCiteTheme } from '../../fixtures';

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Home Page and Evaluation List`, () => {

    test('Navigate to Evaluation from List', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      // 1. The run-level shared evaluations (global-setup) put Admin User on at least one
      //    evaluation's team, so My Evaluations has a row; this test only opens it.
      await loadCiteSeedIds();

      // 2. Navigate to home page
      await page.goto(Services.Cite.UI);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(serviceUrlPattern(Services.Cite.UI), { timeout: 10000 });

      const myEvalsHeading = page.locator('text=My Evaluations');
      await expect(myEvalsHeading).toBeVisible({ timeout: 10000 });

      // 3. Verify evaluation list displays at least one evaluation
      const rows = page.locator('mat-row, tbody tr').filter({ hasNot: page.locator('th') });
      await expect(rows.first()).toBeVisible({ timeout: 15000 });

      // 4. Click on the evaluation row
      await rows.first().click();

      // 5. Verify navigation to evaluation dashboard
      // Evaluation interface loads with dashboard content
      const evaluationContent = page.locator('[class*="evaluation"], [class*="dashboard"], mat-tab-group, [class*="move"]').first();
      await expect(evaluationContent).toBeVisible({ timeout: 10000 });
    });
  });
}
