// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, seedCompleteEvaluation, cleanupCompleteEvaluation, CITE_THEMES, setCiteTheme, citeMoveLabel } from '../../fixtures';

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Evaluation Dashboard Interface`, () => {
    let evaluationIds: { evaluationId: string; scoringModelId: string; teamTypeId: string; } | null = null;

    test('Evaluation Information Display', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      // Create evaluation with team membership via API
      const timestamp = Date.now();
      const description = `Info Test Evaluation ${timestamp}`;
      const seededData = await seedCompleteEvaluation(description);
      evaluationIds = {
        evaluationId: seededData.evaluationId,
        scoringModelId: seededData.scoringModelId,
        teamTypeId: seededData.teamTypeId,
      };

      // 1. Navigate to evaluation dashboard using query parameter
      await page.goto(`${Services.Cite.UI}/?evaluation=${seededData.evaluationId}`);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(new RegExp(seededData.evaluationId), { timeout: 15000 });

      // expect: Evaluation description/name is visible in the toolbar
      await expect(page.getByText(description, { exact: true })).toBeVisible({ timeout: 10000 });

      // expect: Move counter shows "Move 0 of 0" since only the default move exists
      await expect(citeMoveLabel(page)).toHaveText('Move 0 of 0', { timeout: 10000 });

      // expect: Dashboard panels show their counts, even when empty
      for (const panel of ['Actions', 'Duties', 'Roles']) {
        await expect(page.getByRole('button', { name: new RegExp(`^${panel} \\(\\d+\\)$`) })).toBeVisible({ timeout: 10000 });
      }

      // expect: Current move situation card shows the move title, not a "Previous move" label
      await expect(page.getByRole('heading', { name: 'Default Move', level: 2 })).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Previous move', { exact: true })).toHaveCount(0);
    });

    test.afterEach(async () => {
      if (evaluationIds) {
        await cleanupCompleteEvaluation(evaluationIds);
        evaluationIds = null;
      }
    });
  });
}
