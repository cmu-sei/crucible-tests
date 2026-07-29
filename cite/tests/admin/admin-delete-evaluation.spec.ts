// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, seedCompleteEvaluation, cleanupCompleteEvaluation } from '../../fixtures';
import { navigateToAdminSection, waitForAdminListLoad } from '../../test-helpers';

test.describe('Administration - Evaluations', () => {

  let evaluationIds: { scoringModelId: string; evaluationId: string; teamTypeId: string } | null = null;
  let evalName = '';

  test('Delete Evaluation', async ({ citeAuthenticatedPage: page }) => {

    // 1. Seed an evaluation via API
    evalName = `Delete Test ${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
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

    // Find the exact eval row by searching for the cell with exact name match
    const evalRow = page.locator('tbody tr').filter({ has: page.getByRole('cell', { name: evalName, exact: true }) }).first();
    await expect(evalRow).toBeVisible({ timeout: 10000 });

    // Click the row cell to expand and enable action buttons
    const evalCell = evalRow.getByRole('cell', { name: evalName, exact: true });
    await evalCell.click();
    await page.waitForTimeout(1000);

    // 5. Find and click the delete button using getByRole within the row
    const deleteButton = evalRow.getByRole('button', { name: /Delete.*Evaluation/i });
    await expect(deleteButton).toBeVisible({ timeout: 5000 });
    await expect(deleteButton).toBeEnabled({ timeout: 5000 });
    await deleteButton.click();

    // 6. Confirm deletion in dialog
    const confirmDialog = page.getByRole('dialog', { name: 'Delete this evaluation?' });
    await expect(confirmDialog).toBeVisible({ timeout: 10000 });
    const yesButton = confirmDialog.getByRole('button', { name: 'Yes' });
    await yesButton.click();
    await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);

    // 7. Verify the evaluation is gone from the table
    await expect(evalRow).not.toBeVisible({ timeout: 10000 });

    // Mark as cleaned up so afterEach doesn't try to delete again
    evaluationIds = null;
  });

  test.afterEach(async () => {
    // Clean up via API if test didn't delete it
    if (evaluationIds) {
      await cleanupCompleteEvaluation(evaluationIds);
      evaluationIds = null;
    }
  });
});
