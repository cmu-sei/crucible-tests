// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, seedActiveEvaluation, setEvaluationCurrentMove, apiDeleteEvaluation, apiDeleteEvaluationsByName, CITE_THEMES, setCiteTheme, citeMoveLabel } from '../../fixtures';

// One evaluation for the whole file (moves 0-3, Admin User on its team), seeded once. Each
// test advances its current move, so it is a mutator: afterEach sets the current move back
// to 0 through the API, the state beforeAll leaves it in, before the next theme's test.
let evaluationId = '';

test.beforeAll(async () => {
  const name = `E2E Move Boundaries ${test.info().project.name} Evaluation`;
  // A crashed earlier run may have left this file's evaluation behind.
  await apiDeleteEvaluationsByName(name);
  ({ evaluationId } = await seedActiveEvaluation(name, { moves: 3 }));
  // Go through the same set-current-move call afterEach uses, so every test starts from
  // exactly the state the reset restores (the call also copies move 0's situation).
  await setEvaluationCurrentMove(evaluationId, 0);
});

test.afterEach(async () => {
  if (evaluationId) await setEvaluationCurrentMove(evaluationId, 0);
});

test.afterAll(async () => {
  if (evaluationId) await apiDeleteEvaluation(evaluationId);
});

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Evaluation Dashboard Interface`, () => {
    test('Move Navigation - Boundary Conditions', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      // 1. Navigate to evaluation dashboard
      await page.goto(`${Services.Cite.UI}/?evaluation=${evaluationId}`);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(new RegExp(evaluationId), { timeout: 15000 });

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
        await expect(citeMoveLabel(page)).toHaveText(`Move ${i + 1} of 3`, { timeout: 10000 });
      }

      // expect: Now at move 3 (confirmed in loop)
      await expect(citeMoveLabel(page)).toHaveText('Move 3 of 3');

      // expect: Increment should be disabled (can't go beyond current move)
      await expect(incrementButton).toBeDisabled({ timeout: 5000 });

      // expect: Decrement should be enabled (can go back to view history)
      await expect(decrementButton).toBeEnabled({ timeout: 5000 });

      // Navigate back to move 0
      for (let i = 0; i < 3; i++) {
        await decrementButton.click();
        await expect(citeMoveLabel(page)).toHaveText(`Move ${2 - i} of 3`, { timeout: 5000 });
      }

      // expect: Back at move 0 (confirmed in loop)

      // expect: Decrement should now be disabled (can't go below 0)
      await expect(decrementButton).toBeDisabled({ timeout: 5000 });

      // expect: Increment should be enabled (can navigate forward through history)
      await expect(incrementButton).toBeEnabled({ timeout: 5000 });
    });
  });
}
