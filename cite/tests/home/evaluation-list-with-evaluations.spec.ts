// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, serviceUrlPattern, seedCompleteEvaluation, cleanupCompleteEvaluation } from '../../fixtures';

test.describe('Home Page and Evaluation List', () => {
  let evaluationIds: { evaluationId: string; scoringModelId: string; teamTypeId: string; } | null = null;

  test('Evaluation List Display - With Evaluations', async ({ citeAuthenticatedPage: page }) => {
    // 1. Seed a complete evaluation with team and membership via API
    const seededData = await seedCompleteEvaluation(`E2E Display Test Evaluation ${Date.now()}`);
    evaluationIds = {
      evaluationId: seededData.evaluationId,
      scoringModelId: seededData.scoringModelId,
      teamTypeId: seededData.teamTypeId,
    };

    // 2. Navigate to home page
    await page.goto(Services.Cite.UI);
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(serviceUrlPattern(Services.Cite.UI), { timeout: 10000 });

    const myEvalsHeading = page.locator('text=My Evaluations');
    await expect(myEvalsHeading).toBeVisible({ timeout: 10000 });

    // 3. Verify evaluation list table displays
    const table = page.locator('mat-table, table, [class*="evaluation-list"]').first();
    await expect(table).toBeVisible({ timeout: 15000 });

    // 4. Verify table shows expected columns
    const nameColumn = page.locator('th:has-text("Name"), mat-header-cell:has-text("Name"), [class*="header"]:has-text("Name")').first();
    await expect(nameColumn).toBeVisible({ timeout: 5000 });

    const statusColumn = page.locator('th:has-text("Status"), mat-header-cell:has-text("Status"), [class*="header"]:has-text("Status")').first();
    await expect(statusColumn).toBeVisible({ timeout: 5000 });

    // 5. Verify active evaluations are visible in the list
    const rows = page.locator('mat-row, tbody tr').filter({ hasNot: page.locator('th') });
    await expect(rows.first()).toBeVisible({ timeout: 15000 });
  });

  test.afterEach(async () => {
    if (evaluationIds) {
      await cleanupCompleteEvaluation(evaluationIds);
      evaluationIds = null;
    }
  });
});
