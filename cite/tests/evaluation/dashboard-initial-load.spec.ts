// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, loadCiteSeedIds, CITE_THEMES, setCiteTheme, citeMoveLabel } from '../../fixtures';

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Evaluation Dashboard Interface`, () => {
    test('Dashboard Initial Load', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      // The run-level shared evaluation (global-setup): Active, only the default move 0,
      // Admin User on its one team. This test only reads it.
      const seededData = { evaluationId: (await loadCiteSeedIds()).readOnlyEvaluationId };

      // 1. Navigate to evaluation dashboard using query parameter
      await page.goto(`${Services.Cite.UI}/?evaluation=${seededData.evaluationId}`);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(new RegExp(seededData.evaluationId), { timeout: 10000 });

      // expect: Dashboard page loads with evaluation content
      await page.waitForLoadState('domcontentloaded');

      // expect: Move counter is displayed in the toolbar
      await expect(citeMoveLabel(page)).toHaveText('Move 0 of 0', { timeout: 10000 });

      // expect: Team selection is visible
      const teamLabel = page.getByText('Team:');
      await expect(teamLabel).toBeVisible({ timeout: 10000 });

      // expect: Score Summary is displayed
      const scoreSummary = page.getByRole('heading', { name: 'Score Summary' });
      await expect(scoreSummary).toBeVisible({ timeout: 10000 });
    });
  });
}
