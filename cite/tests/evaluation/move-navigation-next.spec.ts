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
  const name = `E2E Move Next ${test.info().project.name} Evaluation`;
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
    test('Move Navigation - Next Move', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      // 1. Navigate to evaluation dashboard
      await page.goto(`${Services.Cite.UI}/?evaluation=${evaluationId}`);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(new RegExp(evaluationId), { timeout: 15000 });

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

      // expect: Now on move 1
      await expect(citeMoveLabel(page)).toHaveText('Move 1 of 3', { timeout: 10000 });

      // 3. Now we can use decrement to go back to move 0
      const decrementButton = page.getByRole('button', { name: 'Decrement Displayed Move' });
      await expect(decrementButton).toBeEnabled({ timeout: 5000 });
      await decrementButton.click();

      // expect: Back to viewing move 0
      await expect(citeMoveLabel(page)).toHaveText('Move 0 of 3', { timeout: 5000 });

      // 4. Now increment to go forward again
      const incrementButton = page.getByRole('button', { name: 'Increment Displayed Move' });
      await expect(incrementButton).toBeEnabled({ timeout: 5000 });
      await incrementButton.click();

      // expect: Back to move 1
      await expect(citeMoveLabel(page)).toHaveText('Move 1 of 3', { timeout: 5000 });
    });
  });
}
