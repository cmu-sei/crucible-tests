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

    // 2. Navigate to the evaluations list and verify the evaluation exists
    await navigateToAdminSection(page, 'Evaluations');
    await page.waitForTimeout(2000);

    const evalRow = page.locator('tbody tr').filter({ hasText: TEST_EVAL_NAME }).first();
    await expect(evalRow).toBeVisible({ timeout: 15000 });

    // 3. Delete the evaluation using the robust helper that handles row selection,
    //    button enable polling, and confirmation. The delete button only becomes
    //    enabled after the row is selected/expanded; the helper handles this.
    const deletedCount = await deleteEvaluationByName(page, TEST_EVAL_NAME);
    expect(deletedCount).toBeGreaterThanOrEqual(1);

    // 4. Verify the evaluation is gone from the table
    await navigateToAdminSection(page, 'Evaluations');
    const deletedRow = page.locator('tbody tr').filter({ hasText: TEST_EVAL_NAME });
    await expect(deletedRow).toHaveCount(0, { timeout: 15000 });
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    await deleteEvaluationByName(page, TEST_EVAL_NAME);
  });
});
