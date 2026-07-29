// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, seedCompleteEvaluation, cleanupCompleteEvaluation } from '../../fixtures';

test.describe('Evaluation Dashboard Interface', () => {
  let evaluationIds: { evaluationId: string; scoringModelId: string; teamTypeId: string; } | null = null;

  test('Dashboard Initial Load', async ({ citeAuthenticatedPage: page }) => {
    // Create evaluation with team membership via API
    const seededData = await seedCompleteEvaluation(`Dashboard Test Evaluation ${Date.now()}`);
    evaluationIds = {
      evaluationId: seededData.evaluationId,
      scoringModelId: seededData.scoringModelId,
      teamTypeId: seededData.teamTypeId,
    };

    // 1. Navigate to evaluation dashboard using query parameter
    await page.goto(`${Services.Cite.UI}/?evaluation=${seededData.evaluationId}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(new RegExp(seededData.evaluationId), { timeout: 10000 });

    // expect: Dashboard page loads with evaluation content
    await page.waitForLoadState('domcontentloaded');

    // expect: Move header is displayed
    const moveLabel = page.getByRole('heading', { name: 'Move:' });
    await expect(moveLabel).toBeVisible({ timeout: 10000 });

    // expect: Team selection is visible
    const teamLabel = page.getByText('Team:');
    await expect(teamLabel).toBeVisible({ timeout: 10000 });

    // expect: Score Summary is displayed
    const scoreSummary = page.getByRole('heading', { name: 'Score Summary' });
    await expect(scoreSummary).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async () => {
    if (evaluationIds) {
      await cleanupCompleteEvaluation(evaluationIds);
      evaluationIds = null;
    }
  });
});
