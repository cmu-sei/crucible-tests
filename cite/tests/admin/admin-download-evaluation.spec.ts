// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, seedCompleteEvaluation, cleanupCompleteEvaluation } from '../../fixtures';
import { navigateToAdminSection, waitForAdminListLoad } from '../../test-helpers';

test.describe('Administration - Evaluations', () => {

  let evaluationIds: { scoringModelId: string; evaluationId: string; teamTypeId: string } | null = null;
  let evalName = '';

  test('Download Evaluation', async ({ citeAuthenticatedPage: page }) => {

    // 1. Seed an evaluation via API
    evalName = `Download Test ${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
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

    // 4. Click the download button on the evaluation row
    const downloadButton = evalRow.locator(`button[title^="Download"]`);
    await expect(downloadButton).toBeVisible({ timeout: 5000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await downloadButton.click();

    // 5. Verify the download completes with a JSON file
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.json');
    expect(download.suggestedFilename()).toContain('evaluation');
  });

  test.afterEach(async () => {
    // Clean up via API
    if (evaluationIds) {
      await cleanupCompleteEvaluation(evaluationIds);
      evaluationIds = null;
    }
  });
});
