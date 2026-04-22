// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection, deleteEvaluationByName, createEvaluation } from '../../test-helpers';

test.describe('Administration - Evaluations', () => {

  const TEST_EVAL_NAME = 'Test Evaluation For Edit';
  const EDITED_EVAL_NAME = 'Edited Evaluation Automation';

  test('Edit Evaluation', async ({ citeAuthenticatedPage: page }) => {

    // 1. Create an evaluation to edit
    await createEvaluation(page, TEST_EVAL_NAME);

    // 2. Navigate to the evaluations list and wait for the evaluation to appear
    await navigateToAdminSection(page, 'Evaluations');
    await page.waitForTimeout(2000);

    const evalRow = page.locator('tbody tr').filter({ hasText: TEST_EVAL_NAME }).first();
    await expect(evalRow).toBeVisible({ timeout: 15000 });

    // 3. Click edit button
    const editButton = evalRow.locator('button[title="Edit Evaluation"]');
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();

    const editDialog = page.getByRole('dialog');
    await expect(editDialog).toBeVisible({ timeout: 5000 });

    // 4. Verify the description is pre-populated and modify it
    const editDescField = editDialog.getByRole('textbox', { name: 'Evaluation Description' });
    await expect(editDescField).toBeVisible({ timeout: 5000 });
    const currentValue = await editDescField.inputValue();
    expect(currentValue).toContain(TEST_EVAL_NAME);

    await editDescField.clear();
    await editDescField.fill(EDITED_EVAL_NAME);

    // 5. Save the edit
    const editSaveButton = editDialog.getByRole('button', { name: 'Save' });
    await expect(editSaveButton).toBeEnabled({ timeout: 5000 });
    await editSaveButton.click();
    await expect(editDialog).not.toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // 6. Verify the edit is reflected
    await navigateToAdminSection(page, 'Evaluations');

    const editedRow = page.locator('tbody tr').filter({ hasText: EDITED_EVAL_NAME }).first();
    await expect(editedRow).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    await deleteEvaluationByName(page, EDITED_EVAL_NAME);
    await deleteEvaluationByName(page, TEST_EVAL_NAME);
  });
});
