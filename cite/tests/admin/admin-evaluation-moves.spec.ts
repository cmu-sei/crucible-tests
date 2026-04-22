// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection, deleteEvaluationByName, createEvaluation } from '../../test-helpers';

test.describe('Administration - Evaluations', () => {

  const TEST_EVAL_NAME = 'Test Evaluation For Moves';

  test('Manage Evaluation Moves', async ({ citeAuthenticatedPage: page }) => {

    // 1. Create an evaluation
    await createEvaluation(page, TEST_EVAL_NAME);

    // 2. Navigate to the evaluations list and wait for the evaluation to appear
    await navigateToAdminSection(page, 'Evaluations');
    await page.waitForTimeout(2000);

    const evalRow = page.locator('tbody tr').filter({ hasText: TEST_EVAL_NAME }).first();
    await expect(evalRow).toBeVisible({ timeout: 15000 });
    await evalRow.click();
    await page.waitForTimeout(2000);

    // 3. Find and expand the Moves panel
    const movesPanel = page.locator('mat-expansion-panel').filter({ hasText: 'Moves' }).first();
    await expect(movesPanel).toBeVisible({ timeout: 10000 });
    // Use direct child selector to avoid selecting nested panel headers
    await movesPanel.locator('> mat-expansion-panel-header').click();
    await page.waitForTimeout(1000);

    // 4. Add a move
    const addMoveButton = movesPanel.locator('button[title="Add Move"]');
    await expect(addMoveButton).toBeVisible({ timeout: 5000 });
    await addMoveButton.click();

    const moveDialog = page.getByRole('dialog');
    await expect(moveDialog).toBeVisible({ timeout: 5000 });

    // Fill the Move Description field (not the Move Number field)
    const moveDescField = moveDialog.getByRole('textbox', { name: 'Move Description' });
    await moveDescField.fill('Move 1 Description');

    const moveSaveButton = moveDialog.getByRole('button', { name: 'Save' });
    await expect(moveSaveButton).toBeEnabled({ timeout: 5000 });
    await moveSaveButton.click();
    await expect(moveDialog).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // 5. Verify the move appears in the list
    const moveItem = movesPanel.locator('text=Move 1 Description');
    await expect(moveItem).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    await deleteEvaluationByName(page, TEST_EVAL_NAME);
  });
});
