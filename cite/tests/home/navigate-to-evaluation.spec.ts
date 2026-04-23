// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { createEvaluation, deleteEvaluationByName, navigateToAdminSection } from '../../test-helpers';

const TEST_EVAL_NAME = 'E2E Navigate Test Evaluation';

test.describe('Home Page and Evaluation List', () => {

  test('Navigate to Evaluation from List', async ({ citeAuthenticatedPage: page }) => {

    // 1. Create an evaluation via admin UI with team membership
    await createEvaluation(page, TEST_EVAL_NAME);

    await navigateToAdminSection(page, 'Evaluations');
    await page.waitForTimeout(2000);

    const evalRow = page.locator('tbody tr').filter({ hasText: TEST_EVAL_NAME }).first();
    await expect(evalRow).toBeVisible({ timeout: 15000 });
    await evalRow.click();
    await page.waitForTimeout(2000);

    const teamsPanel = page.locator('mat-expansion-panel').filter({ hasText: 'Teams' }).first();
    await expect(teamsPanel).toBeVisible({ timeout: 10000 });
    await teamsPanel.locator('mat-expansion-panel-header').click();
    await page.waitForTimeout(1000);

    const addTeamButton = teamsPanel.locator('button[title="Add Team"]');
    await expect(addTeamButton).toBeVisible({ timeout: 5000 });
    await addTeamButton.click();

    const teamDialog = page.getByRole('dialog');
    await expect(teamDialog).toBeVisible({ timeout: 5000 });

    await teamDialog.getByRole('textbox').first().fill('Navigate Test Team');
    await teamDialog.getByRole('textbox').nth(1).fill('NTT');

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
    await page.waitForTimeout(2000);

    // Expand the team and add Admin User as member
    const teamRow = teamsPanel.locator('mat-expansion-panel-header').filter({ hasText: 'Navigate Test Team' });
    await expect(teamRow).toBeVisible({ timeout: 10000 });
    await teamRow.click();
    await page.waitForTimeout(2000);

    const usersSection = teamsPanel.locator('app-admin-team-memberships, app-admin-team-membership-list');
    await expect(usersSection.first()).toBeVisible({ timeout: 10000 });

    const adminRow = usersSection.locator('tr').filter({ hasText: 'Admin User' }).first();
    await expect(adminRow).toBeVisible({ timeout: 15000 });
    const addButton = adminRow.locator('button').filter({ has: page.locator('mat-icon[fonticon*="plus"]') });
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await addButton.click();
    await page.waitForTimeout(2000);

    // 2. Navigate to home page
    await page.goto(Services.Cite.UI);
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });

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
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    await deleteEvaluationByName(page, TEST_EVAL_NAME);
  });
});
