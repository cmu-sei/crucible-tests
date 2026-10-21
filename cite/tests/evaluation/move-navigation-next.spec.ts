// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, seedCompleteEvaluation, cleanupCompleteEvaluation, CITE_THEMES, setCiteTheme, citeMoveLabel } from '../../fixtures';

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Evaluation Dashboard Interface`, () => {
    let evaluationIds: { evaluationId: string; scoringModelId: string; teamTypeId: string; } | null = null;

    test('Move Navigation - Next Move', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      // Create evaluation with team membership and multiple moves via API
      const seededData = await seedCompleteEvaluation(`Move Next Test ${Date.now()}`, 3);
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

      // 2. Advance current move so we can navigate back through history
      const advanceButton = page.getByRole('button', { name: 'Advance Move' });
      await expect(advanceButton).toBeVisible({ timeout: 10000 });
      await advanceButton.click();

      // Confirm the advancement
      const yesButton = page.getByRole('dialog').getByRole('button', { name: 'Yes' });
      await expect(yesButton).toBeVisible({ timeout: 5000 });
      await yesButton.click();
      await page.waitForTimeout(2000);

      // expect: Now on move 1
      await expect(citeMoveLabel(page)).toHaveText('Move 1 of 3', { timeout: 10000 });

      // 3. Now we can use decrement to go back to move 0
      const decrementButton = page.getByRole('button', { name: 'Decrement Displayed Move' });
      await expect(decrementButton).toBeEnabled({ timeout: 5000 });
      await decrementButton.click();
      await page.waitForTimeout(1000);

      // expect: Back to viewing move 0
      await expect(citeMoveLabel(page)).toHaveText('Move 0 of 3', { timeout: 5000 });

      // 4. Now increment to go forward again
      const incrementButton = page.getByRole('button', { name: 'Increment Displayed Move' });
      await expect(incrementButton).toBeEnabled({ timeout: 5000 });
      await incrementButton.click();
      await page.waitForTimeout(1000);

      // expect: Back to move 1
      await expect(citeMoveLabel(page)).toHaveText('Move 1 of 3', { timeout: 5000 });
    });

    test.afterEach(async () => {
      if (evaluationIds) {
        await cleanupCompleteEvaluation(evaluationIds);
        evaluationIds = null;
      }
    });
  });
}
