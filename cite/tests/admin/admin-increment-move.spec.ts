// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection, deleteEvaluationByName, createEvaluation } from '../../test-helpers';

test.describe('Administration - Evaluations', () => {

  const TEST_EVAL_NAME = 'Test Evaluation For Move Increment';

  test('Increment Evaluation Move', async ({ citeAuthenticatedPage: page }) => {

    // 1. Create an evaluation
    await createEvaluation(page, TEST_EVAL_NAME);

    // 2. Navigate to the evaluations list and wait for the evaluation to appear, then expand it
    await navigateToAdminSection(page, 'Evaluations');
    await page.waitForTimeout(2000);

    const evalRow = page.locator('tbody tr').filter({ hasText: TEST_EVAL_NAME }).first();
    await expect(evalRow).toBeVisible({ timeout: 15000 });
    await evalRow.click();
    await page.waitForTimeout(2000);

    // 3. Expand Moves panel and add two moves
    const movesPanel = page.locator('mat-expansion-panel').filter({ hasText: 'Moves' }).first();
    await expect(movesPanel).toBeVisible({ timeout: 10000 });
    await movesPanel.locator('> mat-expansion-panel-header').click();
    await page.waitForTimeout(1000);

    // Add first move
    const addMoveButton = movesPanel.locator('button[title="Add Move"]');
    await addMoveButton.click();
    let moveDialog = page.getByRole('dialog');
    await expect(moveDialog).toBeVisible({ timeout: 5000 });
    await moveDialog.getByRole('textbox', { name: 'Move Description' }).fill('First Move');
    await moveDialog.getByRole('button', { name: 'Save' }).click();
    await expect(moveDialog).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Add second move
    await addMoveButton.click();
    moveDialog = page.getByRole('dialog');
    await expect(moveDialog).toBeVisible({ timeout: 5000 });
    await moveDialog.getByRole('textbox', { name: 'Move Description' }).fill('Second Move');
    await moveDialog.getByRole('button', { name: 'Save' }).click();
    await expect(moveDialog).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // 4. Go back to the evaluations list to use the increment/decrement buttons
    await navigateToAdminSection(page, 'Evaluations');

    const evalRow2 = page.locator('tbody tr').filter({ hasText: TEST_EVAL_NAME }).first();
    await expect(evalRow2).toBeVisible({ timeout: 10000 });

    // 5. Find the current move display and increment button
    const incrementButton = evalRow2.locator('button[title="Increment Move"]');
    await expect(incrementButton).toBeVisible({ timeout: 5000 });

    // Record the current move number
    const moveDisplay = evalRow2.locator('td').filter({ hasText: /^\d+$/ }).first();
    const initialMove = await moveDisplay.textContent();

    // 6. Click increment
    await incrementButton.click();
    await page.waitForTimeout(2000);

    // 7. Verify the move number increased
    await navigateToAdminSection(page, 'Evaluations');
    const evalRow3 = page.locator('tbody tr').filter({ hasText: TEST_EVAL_NAME }).first();
    await expect(evalRow3).toBeVisible({ timeout: 10000 });

    const updatedMoveDisplay = evalRow3.locator('td').filter({ hasText: /^\d+$/ }).first();
    const updatedMove = await updatedMoveDisplay.textContent();
    expect(Number(updatedMove?.trim())).toBeGreaterThan(Number(initialMove?.trim()));
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    await deleteEvaluationByName(page, TEST_EVAL_NAME);
  });
});
