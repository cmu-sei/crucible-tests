// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection, deleteEvaluationByName, createEvaluation } from '../../test-helpers';

test.describe('Administration - Evaluations', () => {

  const TEST_EVAL_NAME = 'Test Evaluation For Teams';

  test('Manage Evaluation Teams', async ({ citeAuthenticatedPage: page }) => {

    // 1. Create an evaluation
    await createEvaluation(page, TEST_EVAL_NAME);

    // 2. Navigate to the evaluations list and wait for the evaluation to appear
    await navigateToAdminSection(page, 'Evaluations');
    await page.waitForTimeout(2000);

    const evalRow = page.locator('tbody tr').filter({ hasText: TEST_EVAL_NAME }).first();
    await expect(evalRow).toBeVisible({ timeout: 15000 });
    await evalRow.click();
    await page.waitForTimeout(2000);

    // 3. Find and expand the Teams panel
    const teamsPanel = page.locator('mat-expansion-panel').filter({ hasText: 'Teams' }).first();
    await expect(teamsPanel).toBeVisible({ timeout: 10000 });
    await teamsPanel.locator('mat-expansion-panel-header').click();
    await page.waitForTimeout(1000);

    // 4. Add a team
    const addTeamButton = teamsPanel.locator('button[title="Add Team"]');
    await expect(addTeamButton).toBeVisible({ timeout: 5000 });
    await addTeamButton.click();

    const teamDialog = page.getByRole('dialog');
    await expect(teamDialog).toBeVisible({ timeout: 5000 });

    // Fill in all required fields: Name, Short Name, and Team Type
    const teamNameField = teamDialog.getByRole('textbox').first();
    await teamNameField.fill('Test Team Alpha');

    const teamShortNameField = teamDialog.getByRole('textbox').nth(1);
    await teamShortNameField.fill('TTA');

    // Select the first team type
    const teamTypeCombobox = teamDialog.getByRole('combobox', { name: 'Team Type' });
    await teamTypeCombobox.click();
    await page.waitForTimeout(500);
    const firstTeamTypeOption = page.getByRole('option').first();
    await expect(firstTeamTypeOption).toBeVisible({ timeout: 5000 });
    await firstTeamTypeOption.click();
    await page.waitForTimeout(500);

    const teamSaveButton = teamDialog.getByRole('button', { name: 'Save' });
    await expect(teamSaveButton).toBeEnabled({ timeout: 5000 });
    await teamSaveButton.click();
    await expect(teamDialog).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // 5. Verify the team appears in the list
    const teamItem = teamsPanel.locator('text=Test Team Alpha');
    await expect(teamItem).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    await deleteEvaluationByName(page, TEST_EVAL_NAME);
  });
});
