// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection, deleteEvaluationByName, deleteTeamTypeByName, createEvaluation } from '../../test-helpers';

test.describe('Administration - Evaluations', () => {

  const TEST_EVAL_NAME = 'Test Evaluation For Actions';
  const TEST_TEAM_TYPE = 'Test TT For Actions';

  test('Manage Evaluation Actions', async ({ citeAuthenticatedPage: page }) => {

    // 1. Create a team type (needed to create a team later)
    await navigateToAdminSection(page, 'Team Types');
    const addTTButton = page.getByRole('button', { name: 'Add TeamType' });
    await expect(addTTButton).toBeVisible({ timeout: 10000 });
    await addTTButton.click();

    const ttDialog = page.getByRole('dialog');
    await expect(ttDialog).toBeVisible({ timeout: 5000 });
    await ttDialog.getByRole('textbox').first().fill(TEST_TEAM_TYPE);
    const ttSaveButton = ttDialog.getByRole('button', { name: 'Save' });
    await expect(ttSaveButton).toBeEnabled({ timeout: 5000 });
    await ttSaveButton.click();
    await expect(ttDialog).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // 2. Create an evaluation
    await createEvaluation(page, TEST_EVAL_NAME);

    // 3. Navigate to evaluations and open the evaluation detail
    await navigateToAdminSection(page, 'Evaluations');
    await page.waitForTimeout(2000);

    const evalRow = page.locator('tbody tr').filter({ hasText: TEST_EVAL_NAME }).first();
    await expect(evalRow).toBeVisible({ timeout: 15000 });
    await evalRow.click();
    await page.waitForTimeout(2000);

    // 4. Add a team to the evaluation (actions require at least one move + one team;
    //    the evaluation has a default move but no teams)
    const teamsPanel = page.locator('mat-expansion-panel').filter({ hasText: /^Teams/ }).first();
    await expect(teamsPanel).toBeVisible({ timeout: 10000 });
    await teamsPanel.locator('> mat-expansion-panel-header').click();
    await page.waitForTimeout(1000);

    const addTeamButton = page.locator('button[title="Add Team"]');
    await expect(addTeamButton).toBeVisible({ timeout: 5000 });
    await addTeamButton.click();

    const teamDialog = page.getByRole('dialog');
    await expect(teamDialog).toBeVisible({ timeout: 5000 });

    // Fill Name field and blur to trigger Angular form control update
    const nameField = teamDialog.getByRole('textbox', { name: 'Name', exact: true });
    await nameField.fill('Test Team');
    await nameField.press('Tab');

    // Fill Short Name field and blur
    const shortNameField = teamDialog.getByRole('textbox', { name: 'Short Name' });
    await shortNameField.fill('TT1');
    await shortNameField.press('Tab');

    // Select team type from dropdown
    const teamTypeSelect = teamDialog.getByRole('combobox', { name: 'Team Type' });
    await teamTypeSelect.click();
    await page.waitForTimeout(1000);
    const teamTypeOption = page.locator('mat-option').filter({ hasText: TEST_TEAM_TYPE });
    await expect(teamTypeOption).toBeVisible({ timeout: 5000 });
    await teamTypeOption.click();
    await page.waitForTimeout(1000);

    // Verify Save is enabled then click it
    const teamSaveButton = teamDialog.getByRole('button', { name: 'Save' });
    await expect(teamSaveButton).toBeEnabled({ timeout: 5000 });
    await teamSaveButton.click();
    await expect(teamDialog).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Verify the team was created
    const teamRow = page.locator('text=Test Team').first();
    await expect(teamRow).toBeVisible({ timeout: 10000 });

    // 5. Expand the Actions panel
    const actionsPanel = page.locator('mat-expansion-panel').filter({ hasText: /^Actions/ }).first();
    await expect(actionsPanel).toBeVisible({ timeout: 10000 });
    await actionsPanel.locator('> mat-expansion-panel-header').click();
    await page.waitForTimeout(1000);

    // 6. Add an action
    const addActionButton = page.locator('button[title="Add Action"]');
    await expect(addActionButton).toBeVisible({ timeout: 5000 });
    await addActionButton.click();

    const actionDialog = page.getByRole('dialog');
    await expect(actionDialog).toBeVisible({ timeout: 5000 });

    await actionDialog.getByRole('textbox', { name: 'Action Description' }).fill('Test Action Description');

    const actionSaveButton = actionDialog.getByRole('button', { name: 'Save' });
    await expect(actionSaveButton).toBeEnabled({ timeout: 5000 });
    await actionSaveButton.click();
    await expect(actionDialog).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // 7. Verify the action appears in the actions table
    const actionItem = page.getByRole('cell', { name: 'Test Action Description', exact: true });
    await expect(actionItem).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    await deleteEvaluationByName(page, TEST_EVAL_NAME);
    await deleteTeamTypeByName(page, TEST_TEAM_TYPE);
  });
});
