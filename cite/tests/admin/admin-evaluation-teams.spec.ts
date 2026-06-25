// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, seedCompleteEvaluation, cleanupCompleteEvaluation } from '../../fixtures';
import { navigateToAdminSection, waitForAdminListLoad } from '../../test-helpers';

test.describe('Administration - Evaluations', () => {

  let evalName = '';
  let seedData: { scoringModelId: string; evaluationId: string; teamTypeId: string } | null = null;

  test('Manage Evaluation Teams', async ({ citeAuthenticatedPage: page }) => {

    // 1. Seed a complete evaluation via API
    evalName = `Teams Test ${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    seedData = await seedCompleteEvaluation(evalName, 0);

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
    await evalRow.click();
    await page.waitForTimeout(1000);

    // 3. Find and expand the Teams panel
    const teamsPanelButton = page.getByRole('button', { name: 'Teams', exact: true });
    await expect(teamsPanelButton).toBeVisible({ timeout: 10000 });
    await teamsPanelButton.click();
    await page.waitForTimeout(1000);

    // 4. Verify the seeded team appears
    const teamItem = page.getByRole('button').filter({ hasText: `Team for ${evalName}` }).first();
    await expect(teamItem).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async () => {
    if (seedData) {
      await cleanupCompleteEvaluation(seedData);
      seedData = null;
    }
  });
});
