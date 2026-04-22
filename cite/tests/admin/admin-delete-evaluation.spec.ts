// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection, deleteEvaluationByName, createEvaluation } from '../../test-helpers';

test.describe('Administration - Evaluations', () => {

  const TEST_EVAL_NAME = 'Test Evaluation For Delete';

  test('Delete Evaluation', async ({ citeAuthenticatedPage: page }) => {

    // 1. Create an evaluation to delete
    await createEvaluation(page, TEST_EVAL_NAME);

    // 2. Navigate to the evaluations list and wait for the evaluation to appear
    await navigateToAdminSection(page, 'Evaluations');
    await page.waitForTimeout(2000);

    const evalRow = page.locator('tbody tr').filter({ hasText: TEST_EVAL_NAME }).first();
    await expect(evalRow).toBeVisible({ timeout: 15000 });

    // 3. Delete the evaluation
    let deleteButton = evalRow.locator(`button[title*="Delete ${TEST_EVAL_NAME}"]`);
    if (!(await deleteButton.isVisible({ timeout: 1000 }).catch(() => false))) {
      deleteButton = evalRow.getByRole('button', { name: 'Delete Evaluation' });
    }
    await expect(deleteButton).toBeVisible({ timeout: 5000 });
    await deleteButton.click();

    const confirmDialog = page.getByRole('dialog', { name: 'Delete this evaluation?' });
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    const yesButton = confirmDialog.getByRole('button', { name: 'Yes' });
    await yesButton.click();
    await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);

    // 4. Verify the evaluation is gone
    const deletedRow = page.locator('tbody tr').filter({ hasText: TEST_EVAL_NAME });
    await expect(deletedRow).toHaveCount(0, { timeout: 10000 });
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    await deleteEvaluationByName(page, TEST_EVAL_NAME);
  });
});
