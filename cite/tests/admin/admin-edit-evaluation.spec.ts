// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, seedCompleteEvaluation, cleanupCompleteEvaluation } from '../../fixtures';
import { navigateToAdminSection, waitForAdminListLoad } from '../../test-helpers';

test.describe('Administration - Evaluations', () => {

  let evaluationIds: { scoringModelId: string; evaluationId: string; teamTypeId: string } | null = null;
  let evalName = '';

  test('Edit Evaluation', async ({ citeAuthenticatedPage: page }) => {

    // 1. Seed an evaluation via API
    evalName = `Edit Test ${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const seedData = await seedCompleteEvaluation(evalName, 0);
    evaluationIds = {
      scoringModelId: seedData.scoringModelId,
      evaluationId: seedData.evaluationId,
      teamTypeId: seedData.teamTypeId,
    };

    // 2. Navigate to the evaluations admin list
    await navigateToAdminSection(page, 'Evaluations');

    // Wait for the async permission + evaluations load chain to complete
    await waitForAdminListLoad(page, '/api/evaluations', true);

    // 3. Search for the evaluation by name to avoid pagination issues
    const searchBox = page.locator('input[placeholder="Search"], input[type="search"], input[aria-label="Search"]').first();
    await expect(searchBox).toBeVisible({ timeout: 5000 });
    await searchBox.clear();
    await searchBox.fill(evalName);
    await page.waitForTimeout(1000);

    const evalRow = page.locator('tbody tr').filter({ hasText: evalName }).first();
    await expect(evalRow).toBeVisible({ timeout: 10000 });

    // 4. Click edit button
    const editButton = evalRow.locator('button[title="Edit Evaluation"]');
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();

    const editDialog = page.getByRole('dialog');
    await expect(editDialog).toBeVisible({ timeout: 5000 });

    // 5. Verify the description is pre-populated and modify it
    const editDescField = editDialog.getByRole('textbox', { name: 'Evaluation Description' });
    await expect(editDescField).toBeVisible({ timeout: 5000 });
    const currentValue = await editDescField.inputValue();
    expect(currentValue).toContain(evalName);

    const editedName = `${evalName} (Edited)`;
    await editDescField.clear();
    await editDescField.fill(editedName);

    // 6. Save the edit
    const editSaveButton = editDialog.getByRole('button', { name: 'Save' });
    await expect(editSaveButton).toBeEnabled({ timeout: 5000 });
    await editSaveButton.click();
    await expect(editDialog).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // 7. Verify the edit is reflected
    await searchBox.clear();
    await searchBox.fill(editedName);
    await page.waitForTimeout(1000);

    const editedRow = page.locator('tbody tr').filter({ hasText: editedName }).first();
    await expect(editedRow).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async () => {
    // Clean up via API
    if (evaluationIds) {
      await cleanupCompleteEvaluation(evaluationIds);
      evaluationIds = null;
    }
  });
});
