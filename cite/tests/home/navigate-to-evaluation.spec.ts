// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, serviceUrlPattern, seedCompleteEvaluation, cleanupCompleteEvaluation } from '../../fixtures';

test.describe('Home Page and Evaluation List', () => {

  test('Navigate to Evaluation from List', async ({ citeAuthenticatedPage: page }) => {
    // 1. Seed a complete evaluation via API with admin as member
    const timestamp = Date.now();
    const evalName = `E2E Navigate Test ${timestamp}`;
    const seededData = await seedCompleteEvaluation(evalName, 0);

    // 2. Navigate to home page
    await page.goto(Services.Cite.UI);
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(serviceUrlPattern(Services.Cite.UI), { timeout: 10000 });

    const myEvalsHeading = page.locator('text=My Evaluations');
    await expect(myEvalsHeading).toBeVisible({ timeout: 10000 });

    // 3. Verify evaluation list displays at least one evaluation
    const rows = page.locator('mat-row, tbody tr').filter({ hasNot: page.locator('th') });
    await expect(rows.first()).toBeVisible({ timeout: 15000 });

    // 4. Click on the evaluation row
    await rows.first().click();

    // 5. Verify navigation to evaluation dashboard
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Evaluation interface loads with dashboard content
    const evaluationContent = page.locator('[class*="evaluation"], [class*="dashboard"], mat-tab-group, [class*="move"]').first();
    await expect(evaluationContent).toBeVisible({ timeout: 10000 });

    // Cleanup
    await cleanupCompleteEvaluation(seededData);
  });
});
