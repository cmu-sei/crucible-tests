// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection, deleteEvaluationByName, createEvaluation } from '../../test-helpers';

test.describe('Administration - Evaluations', () => {

  const TEST_EVAL_NAME = 'Test Evaluation For Copy';
  const COPIED_EVAL_SUFFIX = '- Admin User';

  test('Copy Evaluation', async ({ citeAuthenticatedPage: page }) => {

    // 1. Create an evaluation to copy
    await createEvaluation(page, TEST_EVAL_NAME);

    // 2. Navigate to the evaluations list and wait for the evaluation to appear
    await navigateToAdminSection(page, 'Evaluations');

    // Force a page reload to work around known CITE UI refresh issue where
    // newly created evaluations don't immediately appear in the list
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const evalRow = page.locator('tbody tr').filter({ hasText: TEST_EVAL_NAME }).first();
    await expect(evalRow).toBeVisible({ timeout: 15000 });

    // Click the row to enable action buttons
    await evalRow.click();
    await page.waitForTimeout(500);

    // 3. Copy the evaluation using the copy button (icon: mdi-content-copy)
    // Use more specific selector - title starts with "Copy" not "Download"
    const copyButton = evalRow.locator(`button[title^="Copy"]`);
    await expect(copyButton).toBeVisible({ timeout: 5000 });

    // Wait for the copy operation to complete
    const copyPromise = page.waitForResponse(
      response => response.url().includes('/api/evaluations') && response.request().method() === 'POST' && response.ok(),
      { timeout: 15000 }
    );

    await copyButton.click();
    await copyPromise.catch(() => {});
    await page.waitForTimeout(2000);

    // 4. Verify the copy appears in the list (copy is named "{original} - Admin User")
    // Force a reload to work around known CITE UI refresh issue
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const copiedEvalName = `${TEST_EVAL_NAME} ${COPIED_EVAL_SUFFIX}`;
    const copiedRow = page.locator('tbody tr').filter({ hasText: copiedEvalName }).first();
    await expect(copiedRow).toBeVisible({ timeout: 15000 });
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    // Clean up both the copy and the original
    await deleteEvaluationByName(page, `${TEST_EVAL_NAME} ${COPIED_EVAL_SUFFIX}`);
    await deleteEvaluationByName(page, TEST_EVAL_NAME);
  });
});
