// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, seedCompleteEvaluation, cleanupCompleteEvaluation } from '../../fixtures';
import { navigateToAdminSection, waitForAdminListLoad } from '../../test-helpers';

test.describe('Administration - Evaluations', () => {

  let evalName = '';
  let seedData: { scoringModelId: string; evaluationId: string; teamTypeId: string } | null = null;

  test('Increment Evaluation Move', async ({ citeAuthenticatedPage: page }) => {

    // 1. Seed a complete evaluation via API with 2 moves
    evalName = `Increment Test ${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    seedData = await seedCompleteEvaluation(evalName, 2);

    // 2. Navigate to the evaluations list
    await navigateToAdminSection(page, 'Evaluations');
    await waitForAdminListLoad(page, '/api/evaluations', true);

    // Search for the seeded evaluation
    const searchBox = page.locator('input[placeholder="Search"], input[type="search"], input[aria-label="Search"]').first();
    await expect(searchBox).toBeVisible({ timeout: 5000 });
    await searchBox.clear();
    await searchBox.fill(evalName);
    await page.waitForTimeout(1000);

    const evalRow = page.locator('tbody tr').filter({ hasText: evalName }).first();
    await expect(evalRow).toBeVisible({ timeout: 10000 });

    // 3. Find the current move display and increment button
    const incrementButton = evalRow.locator('button[title="Increment Move"]');
    await expect(incrementButton).toBeVisible({ timeout: 5000 });

    // Record the current move number
    const moveDisplay = evalRow.locator('td').filter({ hasText: /^\d+$/ }).first();
    const initialMove = await moveDisplay.textContent();

    // 4. Click increment
    await incrementButton.click();
    await page.waitForTimeout(1500);

    // 5. Verify the move number increased
    const updatedMoveDisplay = evalRow.locator('td').filter({ hasText: /^\d+$/ }).first();
    const updatedMove = await updatedMoveDisplay.textContent();
    expect(Number(updatedMove?.trim())).toBeGreaterThan(Number(initialMove?.trim()));
  });

  test.afterEach(async () => {
    if (seedData) {
      await cleanupCompleteEvaluation(seedData);
      seedData = null;
    }
  });
});
