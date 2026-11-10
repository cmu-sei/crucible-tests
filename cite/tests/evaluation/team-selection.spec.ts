// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, loadCiteSeedIds, CITE_THEMES, setCiteTheme } from '../../fixtures';

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Evaluation Dashboard Interface`, () => {
    test('Team Selection', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      // The run-level shared evaluation (global-setup): Active, only the default move 0,
      // Admin User on its one team. This test only reads it.
      const seededData = { evaluationId: (await loadCiteSeedIds()).readOnlyEvaluationId };

      // 1. Navigate to evaluation dashboard
      await page.goto(`${Services.Cite.UI}/?evaluation=${seededData.evaluationId}`);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(new RegExp(seededData.evaluationId), { timeout: 15000 });

      // expect: Evaluation dashboard loads with team label and team name displayed
      const teamLabel = page.getByText('Team:');
      await expect(teamLabel).toBeVisible({ timeout: 10000 });

      // Team name should be displayed next to the label
      const teamDisplay = page.locator('text="Team:"').locator('..').getByText(/Team for/);
      await expect(teamDisplay).toBeVisible({ timeout: 10000 });
    });
  });
}
