// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, loadCiteSeedIds, CITE_THEMES, setCiteTheme } from '../../fixtures';

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Evaluation Dashboard Interface`, () => {
    test('Section Navigation - Switch to Report', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      // The run-level shared evaluation (global-setup): Active, only the default move 0,
      // Admin User on its one team. This test only reads it.
      const seededData = { evaluationId: (await loadCiteSeedIds()).readOnlyEvaluationId };

      // 1. Navigate to evaluation dashboard
      await page.goto(`${Services.Cite.UI}/?evaluation=${seededData.evaluationId}`);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(new RegExp(seededData.evaluationId), { timeout: 15000 });

      // 2. Click on 'Submission Review' button to switch to report/submission review view
      const submissionReviewButton = page.getByRole('button', { name: 'Submission Review' });
      await expect(submissionReviewButton).toBeVisible({ timeout: 10000 });
      await submissionReviewButton.click();

      // expect: Report/Submission Review section is now displayed
      // The page stays on same URL but changes section content
      // Wait for report-specific heading
      await expect(page.getByText('Submission Review', { exact: true })).toBeVisible({ timeout: 10000 });
      await expect(page).toHaveURL(new RegExp(seededData.evaluationId), { timeout: 5000 });
    });
  });
}
