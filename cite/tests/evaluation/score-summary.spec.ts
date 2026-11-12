// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, seedCompleteEvaluation, cleanupCompleteEvaluation, CITE_THEMES, setCiteTheme } from '../../fixtures';

const LEVELS = [
  'Level 5 - Emergency',
  'Level 4 - Severe',
  'Level 3 - High',
  'Level 2 - Medium',
  'Level 1 - Low',
  'Level 0 - Baseline',
];

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Score Summary`, () => {
    let evaluationIds: { evaluationId: string; scoringModelId: string; teamTypeId: string; } | null = null;

    test('Score Summary lists the levels and places the displayed score', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      // The seeded scoring model's right side display is the Score Summary
      const seededData = await seedCompleteEvaluation(`Score Summary Test Evaluation ${Date.now()}`);
      evaluationIds = {
        evaluationId: seededData.evaluationId,
        scoringModelId: seededData.scoringModelId,
        teamTypeId: seededData.teamTypeId,
      };

      await page.goto(`${Services.Cite.UI}/?evaluation=${seededData.evaluationId}`);
      await page.waitForLoadState('domcontentloaded');

      const summary = page.locator('app-score-summary');
      await expect(summary.getByRole('heading', { name: 'Score Summary' })).toBeVisible({ timeout: 10000 });

      // expect: every severity level is listed, highest first, with its definition visible
      await expect(summary.getByRole('heading', { level: 2 })).toHaveText(LEVELS);
      await expect(summary.getByText('Unsubstantiated or inconsequential event')).toBeVisible();

      // expect: the displayed move is named
      await expect(summary.getByText('Move 0', { exact: true })).toBeVisible();

      // expect: a new submission scores 0, so it is listed under Baseline and that level is current
      const baseline = summary.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Level 0 - Baseline' }) });
      await expect(baseline).toHaveClass(/current/);
      await expect(baseline.getByRole('list', { name: 'Scores in Baseline' }).getByRole('listitem').first()).toHaveText(/0$/);
      await expect(summary.getByRole('list', { name: 'Scores in Emergency' })).toHaveCount(0);
    });

    test.afterEach(async () => {
      if (evaluationIds) {
        await cleanupCompleteEvaluation(evaluationIds);
        evaluationIds = null;
      }
    });
  });
}
