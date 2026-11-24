// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, loadCiteSeedIds, CITE_THEMES, setCiteTheme } from '../../fixtures';

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Evaluation Dashboard Interface`, () => {
    test('Section Navigation - Switch to Aggregate', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      // The run-level shared evaluation (global-setup): Active, only the default move 0,
      // Admin User on its one team. This test only reads it.
      const seededData = { evaluationId: (await loadCiteSeedIds()).readOnlyEvaluationId };

      // 1. Navigate to evaluation dashboard
      await page.goto(`${Services.Cite.UI}/?evaluation=${seededData.evaluationId}`);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(new RegExp(seededData.evaluationId), { timeout: 15000 });

      // 2. Click on 'Aggregate Report' button to switch to aggregate view
      const aggregateButton = page.getByRole('button', { name: 'Aggregate Report' });
      await expect(aggregateButton).toBeVisible({ timeout: 10000 });
      await aggregateButton.click();

      // expect: Aggregate section is now displayed
      // The page stays on same URL but changes section content
      // Wait for aggregate-specific heading
      await expect(page.getByText('Aggregate Report', { exact: true })).toBeVisible({ timeout: 10000 });
      await expect(page).toHaveURL(new RegExp(seededData.evaluationId), { timeout: 5000 });
    });
  });
}
