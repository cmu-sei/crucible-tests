// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, seedCompleteEvaluation, cleanupCompleteEvaluation } from '../../fixtures';
import { navigateToAdminSection, waitForAdminListLoad } from '../../test-helpers';

test.describe('Administration - Evaluations', () => {

  let evalName = '';
  let seedData: { scoringModelId: string; evaluationId: string; teamTypeId: string } | null = null;

  test('Manage Evaluation Duties', async ({ citeAuthenticatedPage: page }) => {

    // 1. Seed a complete evaluation via API (includes team)
    evalName = `Duties Test ${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
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

    // 3. Find and expand the Duties panel
    const dutiesPanelButton = page.getByRole('button', { name: 'Duties', exact: true });
    await expect(dutiesPanelButton).toBeVisible({ timeout: 10000 });
    await dutiesPanelButton.click();
    await page.waitForTimeout(1000);

    // 4. Add a duty
    const addDutyButton = page.locator('button[title="Add Duty"]');
    await expect(addDutyButton).toBeVisible({ timeout: 5000 });
    await addDutyButton.click();

    const dutyDialog = page.getByRole('dialog');
    await expect(dutyDialog).toBeVisible({ timeout: 5000 });

    // Fill in the duty name
    const dutyNameField = dutyDialog.getByRole('textbox', { name: 'Duty Name' });
    await expect(dutyNameField).toBeVisible({ timeout: 5000 });
    await dutyNameField.fill('Test Duty Name');

    // Wait for the Save button to become enabled
    const dutySaveButton = dutyDialog.getByRole('button', { name: 'Save' });
    await expect(dutySaveButton).toBeEnabled({ timeout: 5000 });
    await dutySaveButton.click();

    // Wait for the dialog to close and the duty to be created
    await expect(dutyDialog).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // 5. Verify the duty appears within the Duties region
    const dutiesRegion = page.getByRole('region', { name: 'Duties' });
    const dutyItem = dutiesRegion.getByText('Test Duty Name').first();
    await expect(dutyItem).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async () => {
    if (seedData) {
      await cleanupCompleteEvaluation(seedData);
      seedData = null;
    }
  });
});
