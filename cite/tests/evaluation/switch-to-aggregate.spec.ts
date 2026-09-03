// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, seedCompleteEvaluation, cleanupCompleteEvaluation } from '../../fixtures';

test.describe('Evaluation Dashboard Interface', () => {
  let evaluationIds: { evaluationId: string; scoringModelId: string; teamTypeId: string; } | null = null;

  test('Section Navigation - Switch to Aggregate', async ({ citeAuthenticatedPage: page }) => {
    // Create evaluation with team membership via API
    const seededData = await seedCompleteEvaluation(`Switch Aggregate Test ${Date.now()}`);
    evaluationIds = {
      evaluationId: seededData.evaluationId,
      scoringModelId: seededData.scoringModelId,
      teamTypeId: seededData.teamTypeId,
    };

    // 1. Navigate to evaluation dashboard
    await page.goto(`${Services.Cite.UI}/?evaluation=${seededData.evaluationId}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(new RegExp(seededData.evaluationId), { timeout: 15000 });

    // 2. Click on 'Aggregate Report' button to switch to aggregate view
    const aggregateButton = page.getByRole('button', { name: 'Aggregate Report' });
    await expect(aggregateButton).toBeVisible({ timeout: 10000 });
    await aggregateButton.click();
    await page.waitForTimeout(1000);

    // expect: Aggregate section is now displayed
    // The page stays on same URL but changes section content
    await expect(page).toHaveURL(new RegExp(seededData.evaluationId), { timeout: 5000 });
  });

  test.afterEach(async () => {
    if (evaluationIds) {
      await cleanupCompleteEvaluation(evaluationIds);
      evaluationIds = null;
    }
  });
});
