// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection, deleteEvaluationByName, createEvaluation } from '../../test-helpers';

test.describe('Administration - Evaluations', () => {

  const TEST_EVAL_NAME = 'Test Evaluation For Duties';

  test('Manage Evaluation Duties', async ({ citeAuthenticatedPage: page }) => {

    // 1. Create an evaluation
    await createEvaluation(page, TEST_EVAL_NAME);

    // 2. Navigate to the evaluations list and wait for the evaluation to appear
    await navigateToAdminSection(page, 'Evaluations');
    await page.waitForTimeout(2000);

    const evalRow = page.locator('tbody tr').filter({ hasText: TEST_EVAL_NAME }).first();
    await expect(evalRow).toBeVisible({ timeout: 15000 });
    await evalRow.click();
    await page.waitForTimeout(2000);

    // 3. First create a team (required for duties to work properly)
    const teamsPanel = page.locator('mat-expansion-panel').filter({ hasText: 'Teams' }).first();
    await expect(teamsPanel).toBeVisible({ timeout: 10000 });
    await teamsPanel.locator('mat-expansion-panel-header').click();
    await page.waitForTimeout(1000);

    const addTeamButton = teamsPanel.locator('button[title="Add Team"]');
    await expect(addTeamButton).toBeVisible({ timeout: 5000 });
    await addTeamButton.click();

    const teamDialog = page.getByRole('dialog');
    await expect(teamDialog).toBeVisible({ timeout: 5000 });

    // Fill in all required fields: Name, Short Name, and Team Type
    // Use .first() and .last() to target the specific fields since both have similar attributes
    const teamNameField = teamDialog.getByRole('textbox').first();
    await teamNameField.fill('Test Team');

    const teamShortNameField = teamDialog.getByRole('textbox').nth(1);
    await teamShortNameField.fill('TTT');

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

    // 4. Find and expand the Duties panel
    const dutiesPanel = page.locator('mat-expansion-panel').filter({ hasText: 'Duties' }).first();
    await expect(dutiesPanel).toBeVisible({ timeout: 10000 });
    await dutiesPanel.locator('mat-expansion-panel-header').click();
    await page.waitForTimeout(1000);

    // 5. Add a duty
    const addDutyButton = dutiesPanel.locator('button[title="Add Duty"]');
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
    await page.waitForTimeout(2000);

    // 6. Verify the duty appears
    const dutyItem = dutiesPanel.locator('text=Test Duty Name');
    await expect(dutyItem).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    await deleteEvaluationByName(page, TEST_EVAL_NAME);
  });
});
