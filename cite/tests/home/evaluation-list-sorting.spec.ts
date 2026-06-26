// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, serviceUrlPattern, seedCompleteEvaluation, cleanupCompleteEvaluation } from '../../fixtures';

test.describe('Home Page and Evaluation List', () => {
  let evaluation1Ids: { evaluationId: string; scoringModelId: string; teamTypeId: string; } | null = null;
  let evaluation2Ids: { evaluationId: string; scoringModelId: string; teamTypeId: string; } | null = null;

  test('Evaluation List Sorting', async ({ citeAuthenticatedPage: page }) => {
    const timestamp = Date.now();

    // 1. Create two evaluations via API with team memberships
    const seededData1 = await seedCompleteEvaluation(`E2E Sort Alpha ${timestamp}`);
    evaluation1Ids = {
      evaluationId: seededData1.evaluationId,
      scoringModelId: seededData1.scoringModelId,
      teamTypeId: seededData1.teamTypeId,
    };

    const seededData2 = await seedCompleteEvaluation(`E2E Sort Beta ${timestamp}`);
    evaluation2Ids = {
      evaluationId: seededData2.evaluationId,
      scoringModelId: seededData2.scoringModelId,
      teamTypeId: seededData2.teamTypeId,
    };

    // 2. Navigate to home page
    await page.goto(Services.Cite.UI);
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(serviceUrlPattern(Services.Cite.UI), { timeout: 10000 });

    const myEvalsHeading = page.locator('text=My Evaluations');
    await expect(myEvalsHeading).toBeVisible({ timeout: 10000 });

    // 3. Wait for evaluation rows to load
    const rows = page.locator('mat-row, tbody tr').filter({ hasNot: page.locator('th') });
    await expect(rows.first()).toBeVisible({ timeout: 15000 });

    // 4. Click on the 'Name' column header to sort ascending
    const nameHeader = page.locator('th:has-text("Name"), mat-header-cell:has-text("Name"), [mat-sort-header]:has-text("Name")').first();
    await nameHeader.click();
    await page.waitForTimeout(500);

    // Verify sort indicator appears
    const sortIndicator = nameHeader.locator('.mat-sort-header-arrow, mat-sort-header-arrow');
    await expect(sortIndicator).toBeVisible({ timeout: 5000 });

    // 5. Click again to sort descending
    await nameHeader.click();
    await page.waitForTimeout(500);
  });

  test.afterEach(async () => {
    if (evaluation1Ids) {
      await cleanupCompleteEvaluation(evaluation1Ids);
      evaluation1Ids = null;
    }
    if (evaluation2Ids) {
      await cleanupCompleteEvaluation(evaluation2Ids);
      evaluation2Ids = null;
    }
  });
});
