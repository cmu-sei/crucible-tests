// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, seedCompleteEvaluation, cleanupCompleteEvaluation } from '../../fixtures';

test.describe('Evaluation Dashboard Interface', () => {
  let evaluationIds: { evaluationId: string; scoringModelId: string; teamTypeId: string; } | null = null;

  test('Evaluation Information Display', async ({ citeAuthenticatedPage: page }) => {
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

    // expect: Evaluation description/name is visible in the header
    const evalHeading = page.getByRole('heading', { name: new RegExp(description.substring(0, 20)) });
    await expect(evalHeading).toBeVisible({ timeout: 10000 });

    // expect: Move counter label is displayed
    const moveLabel = page.getByRole('heading', { name: 'Move:' });
    await expect(moveLabel).toBeVisible({ timeout: 10000 });

    // expect: Move total is displayed (e.g., "of 0" since no moves added)
    const moveTotal = page.getByRole('heading', { name: 'of 0' });
    await expect(moveTotal).toBeVisible({ timeout: 10000 });

    // expect: Dashboard sections are available (Actions, Duties, Roles)
    const actionsSection = page.getByText('Actions:');
    await expect(actionsSection).toBeVisible({ timeout: 10000 });

    // expect: Current Move situation is displayed
    const currentMoveLabel = page.getByText('Current Move:');
    await expect(currentMoveLabel).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async () => {
    if (evaluationIds) {
      await cleanupCompleteEvaluation(evaluationIds);
      evaluationIds = null;
    }
  });
});
