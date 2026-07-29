// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, seedCompleteEvaluation, cleanupCompleteEvaluation } from '../../fixtures';

test.describe('Evaluation Dashboard Interface', () => {
  let evaluationIds: { evaluationId: string; scoringModelId: string; teamTypeId: string; } | null = null;

  test('Move Navigation - Boundary Conditions', async ({ citeAuthenticatedPage: page }) => {
    // Create evaluation with team membership and multiple moves via API
    const seededData = await seedCompleteEvaluation(`Move Boundaries Test ${Date.now()}`, 3);
    evaluationIds = {
      evaluationId: seededData.evaluationId,
      scoringModelId: seededData.scoringModelId,
      teamTypeId: seededData.teamTypeId,
    };

    // 1. Navigate to evaluation dashboard
    await page.goto(`${Services.Cite.UI}/?evaluation=${seededData.evaluationId}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(new RegExp(seededData.evaluationId), { timeout: 15000 });

    // expect: Move controls are visible
    const decrementButton = page.getByRole('button', { name: 'Decrement Displayed Move' });
    const incrementButton = page.getByRole('button', { name: 'Increment Displayed Move' });

    await expect(decrementButton).toBeVisible({ timeout: 10000 });
    await expect(incrementButton).toBeVisible({ timeout: 10000 });

    // At move 0 with current move also 0, both navigation buttons should be disabled
    await expect(decrementButton).toBeDisabled({ timeout: 5000 });
    await expect(incrementButton).toBeDisabled({ timeout: 5000 });

    // Advance current move to 3 to create navigable history
    const advanceButton = page.getByRole('button', { name: 'Advance Move' });
    await expect(advanceButton).toBeVisible({ timeout: 10000 });

    for (let i = 0; i < 3; i++) {
      await advanceButton.click();
      const yesButton = page.getByRole('dialog').getByRole('button', { name: 'Yes' });
      await expect(yesButton).toBeVisible({ timeout: 5000 });
      await yesButton.click();
      await page.waitForTimeout(2000);
    }

    // expect: Now at move 3
    let moveLabel = page.locator('text="Move:"').locator('..').getByRole('heading', { name: /^3$/ });
    await expect(moveLabel).toBeVisible({ timeout: 10000 });

    // expect: Increment should be disabled (can't go beyond current move)
    await expect(incrementButton).toBeDisabled({ timeout: 5000 });

    // expect: Decrement should be enabled (can go back to view history)
    await expect(decrementButton).toBeEnabled({ timeout: 5000 });

    // Navigate back to move 0
    for (let i = 0; i < 3; i++) {
      await decrementButton.click();
      await page.waitForTimeout(1000);
    }

    // expect: Back at move 0
    moveLabel = page.locator('text="Move:"').locator('..').getByRole('heading', { name: /^0$/ });
    await expect(moveLabel).toBeVisible({ timeout: 5000 });

    // expect: Decrement should now be disabled (can't go below 0)
    await expect(decrementButton).toBeDisabled({ timeout: 5000 });

    // expect: Increment should be enabled (can navigate forward through history)
    await expect(incrementButton).toBeEnabled({ timeout: 5000 });
  });

  test.afterEach(async () => {
    if (evaluationIds) {
      await cleanupCompleteEvaluation(evaluationIds);
      evaluationIds = null;
    }
  });
});
