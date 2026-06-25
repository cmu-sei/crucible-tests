// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, seedCompleteEvaluation, cleanupCompleteEvaluation } from '../../fixtures';
import { navigateToAdminSection, waitForAdminListLoad } from '../../test-helpers';

test.describe('Administration - Evaluations', () => {

  let evaluationIds: { scoringModelId: string; evaluationId: string; teamTypeId: string } | null = null;
  let evalName = '';
  const COPIED_EVAL_SUFFIX = '- Admin User';

  test('Copy Evaluation', async ({ citeAuthenticatedPage: page }) => {

    // 1. Seed an evaluation via API
    evalName = `Copy Test ${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
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

    // 3. Search for the seeded evaluation
    const searchBox = page.locator('input[placeholder="Search"], input[type="search"], input[aria-label="Search"]').first();
    await expect(searchBox).toBeVisible({ timeout: 5000 });
    await searchBox.clear();
    await searchBox.fill(evalName);
    await page.waitForTimeout(1000);

    const evalRow = page.locator('tbody tr').filter({ hasText: evalName }).first();
    await expect(evalRow).toBeVisible({ timeout: 10000 });

    // 4. Click the row to enable action buttons
    await evalRow.click();
    await page.waitForTimeout(500);

    // 5. Copy the evaluation using the copy button
    const copyButton = evalRow.locator(`button[title^="Copy"]`);
    await expect(copyButton).toBeVisible({ timeout: 5000 });

    // Wait for the copy operation to complete
    const copyPromise = page.waitForResponse(
      response => response.url().includes('/api/evaluations') && response.request().method() === 'POST' && response.ok(),
      { timeout: 15000 }
    );

    await copyButton.click();
    await copyPromise.catch(() => {});
    await page.waitForTimeout(1000);

    // 6. Verify the copy appears in the list (copy is named "{original} - Admin User")
    const copiedEvalName = `${evalName} ${COPIED_EVAL_SUFFIX}`;
    await searchBox.clear();
    await searchBox.fill(copiedEvalName);
    await page.waitForTimeout(1000);

    const copiedRow = page.locator('tbody tr').filter({ hasText: copiedEvalName }).first();
    await expect(copiedRow).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async () => {
    // Clean up via API (cascades to related resources)
    if (evaluationIds) {
      await cleanupCompleteEvaluation(evaluationIds);
      evaluationIds = null;
    }
  });
});
