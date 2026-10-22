// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, seedCompleteEvaluation, cleanupCompleteEvaluation, CITE_THEMES, setCiteTheme, citeMoveLabel } from '../../fixtures';

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Evaluation Dashboard Interface`, () => {
    let evaluationIds: { evaluationId: string; scoringModelId: string; teamTypeId: string; } | null = null;

    test('Move Navigation - Previous Move', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

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

      // expect: Dashboard displays "of 3", the highest of moves 0-3
      await expect(citeMoveLabel(page)).toHaveText('Move 0 of 3', { timeout: 10000 });

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
      await expect(citeMoveLabel(page)).toHaveText('Move 2 of 3', { timeout: 10000 });

      // expect: The situation card shows the current move without a "Previous move" label
      const previousLabel = page.getByText('Previous move', { exact: true });
      await expect(page.getByRole('heading', { name: 'Move 2', level: 2 })).toBeVisible({ timeout: 5000 });
      await expect(previousLabel).toHaveCount(0);

      // 3. Use decrement button to go back to move 1
      const decrementButton = page.getByRole('button', { name: 'Decrement Displayed Move' });
      await expect(decrementButton).toBeEnabled({ timeout: 5000 });
      await decrementButton.click();
      await page.waitForTimeout(1000);

      // expect: Now viewing move 1
      await expect(citeMoveLabel(page)).toHaveText('Move 1 of 3', { timeout: 5000 });

      // expect: The situation card shows move 1's own situation, labeled as a previous move
      await expect(page.getByRole('heading', { name: 'Move 1', level: 2 })).toBeVisible({ timeout: 5000 });
      await expect(previousLabel).toBeVisible();
      await expect(page.getByText('Situation for Move 1', { exact: true })).toBeVisible();

      // 4. Decrement again to move 0
      await decrementButton.click();
      await page.waitForTimeout(1000);

      // expect: Now viewing move 0
      await expect(citeMoveLabel(page)).toHaveText('Move 0 of 3', { timeout: 5000 });
    });

    test.afterEach(async () => {
      if (evaluationIds) {
        await cleanupCompleteEvaluation(evaluationIds);
        evaluationIds = null;
      }
    });
  });
}
