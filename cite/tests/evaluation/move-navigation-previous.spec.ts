// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, seedCompleteEvaluation, cleanupCompleteEvaluation } from '../../fixtures';

test.describe('Evaluation Dashboard Interface', () => {
  let evaluationIds: { evaluationId: string; scoringModelId: string; teamTypeId: string; } | null = null;

  test('Move Navigation - Previous Move', async ({ citeAuthenticatedPage: page }) => {
    // Create evaluation with team membership and multiple moves via API
    const seededData = await seedCompleteEvaluation(`Move Prev Test ${Date.now()}`, 3);
    evaluationIds = {
      evaluationId: seededData.evaluationId,
      scoringModelId: seededData.scoringModelId,
      teamTypeId: seededData.teamTypeId,
    };

    // 1. Navigate to evaluation dashboard
    await page.goto(`${Services.Cite.UI}/?evaluation=${seededData.evaluationId}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(new RegExp(seededData.evaluationId), { timeout: 15000 });

    // expect: Dashboard displays with "of 3" indicating 3 moves exist
    const movesTotal = page.getByRole('heading', { name: 'of 3' });
    await expect(movesTotal).toBeVisible({ timeout: 10000 });

    // 2. Advance current move twice so we have history to navigate
    const advanceButton = page.getByRole('button', { name: 'Advance Move' });
    await expect(advanceButton).toBeVisible({ timeout: 10000 });

    // Advance to move 1
    await advanceButton.click();
    let yesButton = page.getByRole('dialog').getByRole('button', { name: 'Yes' });
    await expect(yesButton).toBeVisible({ timeout: 5000 });
    await yesButton.click();
    await page.waitForTimeout(2000);

    // Advance to move 2
    await advanceButton.click();
    yesButton = page.getByRole('dialog').getByRole('button', { name: 'Yes' });
    await expect(yesButton).toBeVisible({ timeout: 5000 });
    await yesButton.click();
    await page.waitForTimeout(2000);

    // expect: Now on move 2
    let moveLabel = page.locator('text="Move:"').locator('..').getByRole('heading', { name: /^2$/ });
    await expect(moveLabel).toBeVisible({ timeout: 10000 });

    // 3. Use decrement button to go back to move 1
    const decrementButton = page.getByRole('button', { name: 'Decrement Displayed Move' });
    await expect(decrementButton).toBeEnabled({ timeout: 5000 });
    await decrementButton.click();
    await page.waitForTimeout(1000);

    // expect: Now viewing move 1
    moveLabel = page.locator('text="Move:"').locator('..').getByRole('heading', { name: /^1$/ });
    await expect(moveLabel).toBeVisible({ timeout: 5000 });

    // 4. Decrement again to move 0
    await decrementButton.click();
    await page.waitForTimeout(1000);

    // expect: Now viewing move 0
    moveLabel = page.locator('text="Move:"').locator('..').getByRole('heading', { name: /^0$/ });
    await expect(moveLabel).toBeVisible({ timeout: 5000 });
  });

  test.afterEach(async () => {
    if (evaluationIds) {
      await cleanupCompleteEvaluation(evaluationIds);
      evaluationIds = null;
    }
  });
});
