// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

// This file combines all report tests into a single file to run them serially,
// avoiding parallel execution issues where multiple tests compete for the same "Admin User" visibility.

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection, deleteEvaluationByName, deleteTeamTypeByName } from '../../test-helpers';

// Test data constants
const EXPORT_TEAM_TYPE = 'E2E Export Team Type';
const EXPORT_EVAL_NAME = 'E2E Export Test Evaluation';

const COMPARISON_TEAM_TYPE = 'E2E Comparison Team Type';
const COMPARISON_EVAL_NAME = 'E2E Comparison Test Evaluation';

const DISPLAY_TEAM_TYPE = 'E2E Display Team Type';
const DISPLAY_EVAL_NAME = 'E2E Display Test Evaluation';

async function createActiveEvalWithMoveAndTeam(page: import('@playwright/test').Page, teamTypeName: string, evalName: string, teamName: string, teamShortName: string) {
  // 1. Create a team type
  await navigateToAdminSection(page, 'Team Types');

  const addTeamTypeButton = page.getByRole('button', { name: 'Add TeamType' });
  await expect(addTeamTypeButton).toBeVisible({ timeout: 10000 });
  await addTeamTypeButton.click();

  const teamTypeDialog = page.getByRole('dialog');
  await expect(teamTypeDialog).toBeVisible({ timeout: 5000 });
  await teamTypeDialog.getByRole('textbox').first().fill(teamTypeName);
  await teamTypeDialog.getByRole('button', { name: 'Save' }).click();
  await expect(teamTypeDialog).not.toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(1000);

  // 2. Create an evaluation with Active status
  await navigateToAdminSection(page, 'Evaluations');

  const addEvalButton = page.getByRole('button', { name: 'Add Evaluation' });
  await expect(addEvalButton).toBeVisible({ timeout: 10000 });
  await addEvalButton.click();

  const evalDialog = page.getByRole('dialog', { name: 'Add Evaluation' });
  await expect(evalDialog).toBeVisible({ timeout: 5000 });

  await page.getByRole('textbox', { name: 'Evaluation Description' }).fill(evalName);

  const scoringModelSelect = page.getByRole('combobox', { name: 'Scoring Model' });
  await expect(scoringModelSelect).toBeVisible({ timeout: 5000 });
  await page.waitForResponse(
    response => response.url().includes('/api/scoringmodels') && response.status() === 200,
    { timeout: 15000 }
  ).catch(() => {});
  await page.waitForTimeout(1500);
  await scoringModelSelect.click();
  await page.waitForTimeout(1000);

  let firstOption = page.locator('mat-option').first();
  if (!(await firstOption.isVisible({ timeout: 1000 }).catch(() => false))) {
    const matSelect = page.locator('mat-select[formcontrolname="scoringModelId"], mat-select[ng-reflect-name="scoringModelId"]').first();
    if (await matSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      await matSelect.click();
      await page.waitForTimeout(1000);
    }
  }
  firstOption = page.locator('mat-option').first();
  await expect(firstOption).toBeVisible({ timeout: 10000 });
  await firstOption.click();
  await page.waitForTimeout(1000);

  const statusSelect = page.getByRole('combobox', { name: 'Evaluation Status' });
  await expect(statusSelect).toBeVisible({ timeout: 5000 });
  await statusSelect.click();
  await page.waitForTimeout(500);
  await page.getByRole('option', { name: 'Active' }).click();
  await page.waitForTimeout(500);

  const createPromise = page.waitForResponse(
    response => response.url().includes('/api/evaluations') && response.request().method() === 'POST' && response.ok(),
    { timeout: 15000 }
  );
  await evalDialog.getByRole('button', { name: 'Save' }).click();
  await createPromise.catch(() => {});
  await expect(evalDialog).not.toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(3000);

  // 3. Add a move
  await navigateToAdminSection(page, 'Evaluations');
  await page.waitForTimeout(2000);

  const evalRow = page.locator('tbody tr').filter({ hasText: evalName }).first();
  await expect(evalRow).toBeVisible({ timeout: 15000 });
  await evalRow.click();
  await page.waitForTimeout(2000);

  const movesPanel = page.locator('mat-expansion-panel').filter({ hasText: 'Moves' }).first();
  await expect(movesPanel).toBeVisible({ timeout: 10000 });
  await movesPanel.locator('mat-expansion-panel-header').first().click();
  await page.waitForTimeout(1000);

  const addMoveButton = movesPanel.locator('button[title="Add Move"]');
  await expect(addMoveButton).toBeVisible({ timeout: 5000 });
  await addMoveButton.click();

  const moveDialog = page.getByRole('dialog');
  await expect(moveDialog).toBeVisible({ timeout: 5000 });
  await moveDialog.getByRole('textbox', { name: 'Move Description' }).fill('Move 1');
  await moveDialog.getByRole('button', { name: 'Save' }).click();
  await expect(moveDialog).not.toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(1000);

  // 4. Add a team
  const teamsPanel = page.locator('mat-expansion-panel').filter({ hasText: 'Teams' }).first();
  await expect(teamsPanel).toBeVisible({ timeout: 10000 });
  await teamsPanel.locator('mat-expansion-panel-header').first().click();
  await page.waitForTimeout(1000);

  const addTeamButton = teamsPanel.locator('button[title="Add Team"]');
  await expect(addTeamButton).toBeVisible({ timeout: 5000 });
  await addTeamButton.click();

  const teamDialog = page.getByRole('dialog');
  await expect(teamDialog).toBeVisible({ timeout: 5000 });

  await teamDialog.getByRole('textbox').first().fill(teamName);
  await teamDialog.getByRole('textbox').nth(1).fill(teamShortName);

  const teamTypeCombobox = teamDialog.getByRole('combobox', { name: 'Team Type' });
  await teamTypeCombobox.click();
  await page.waitForTimeout(500);
  await page.getByRole('option', { name: teamTypeName }).first().click();
  await page.waitForTimeout(500);

  await teamDialog.getByRole('button', { name: 'Save' }).click();
  await expect(teamDialog).not.toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(2000);

  // 5. Add Admin User as team member
  let teamRow = teamsPanel.locator('mat-expansion-panel-header').filter({ hasText: teamName });
  if (!(await teamRow.isVisible({ timeout: 5000 }).catch(() => false))) {
    await navigateToAdminSection(page, 'Evaluations');
    await page.waitForTimeout(2000);
    const refreshedRow = page.locator('tbody tr').filter({ hasText: evalName }).first();
    await expect(refreshedRow).toBeVisible({ timeout: 15000 });
    await refreshedRow.click();
    await page.waitForTimeout(2000);
    const refreshedTeams = page.locator('mat-expansion-panel').filter({ hasText: 'Teams' }).first();
    await refreshedTeams.locator('mat-expansion-panel-header').first().click();
    await page.waitForTimeout(1000);
    teamRow = refreshedTeams.locator('mat-expansion-panel-header').filter({ hasText: teamName });
  }
  await expect(teamRow).toBeVisible({ timeout: 10000 });
  await teamRow.click();
  await page.waitForTimeout(2000);

  const membershipArea = page.locator('mat-expansion-panel').filter({ hasText: 'Teams' }).first().locator('app-admin-team-memberships').first();
  await expect(membershipArea).toBeVisible({ timeout: 10000 });

  const membersList = membershipArea.locator('app-admin-team-member-list');
  const alreadyMember = membersList.locator('tr').filter({ hasText: 'Admin User' }).first();
  if (!(await alreadyMember.isVisible({ timeout: 3000 }).catch(() => false))) {
    const usersList = membershipArea.locator('app-admin-team-membership-list');
    const adminRow = usersList.locator('tr').filter({ hasText: 'Admin User' }).first();
    await expect(adminRow).toBeVisible({ timeout: 15000 });
    const addButton = adminRow.locator('button').filter({ has: page.locator('mat-icon[fonticon*="plus"]') });
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await addButton.click();
    await page.waitForTimeout(2000);
  }
}

async function navigateToEvaluation(page: import('@playwright/test').Page, evalName: string, searchText: string) {
  // Navigate to home page and click into the evaluation
  await page.goto(Services.Cite.UI);
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });

  const myEvalsHeading = page.locator('text=My Evaluations');
  await expect(myEvalsHeading).toBeVisible({ timeout: 10000 });

  const homeRows = page.locator('mat-row, tbody tr').filter({ hasNot: page.locator('th') });
  await expect(homeRows.first()).toBeVisible({ timeout: 15000 });

  // Use search box to filter for the specific evaluation
  const searchBox = page.locator('input[placeholder="Search"], input[type="search"], input[aria-label="Search"]');
  if (await searchBox.isVisible({ timeout: 2000 }).catch(() => false)) {
    await searchBox.fill(searchText);
    await page.waitForTimeout(1000);
  }

  // Poll for the evaluation to appear with retries
  const evalLink = page.locator(`a:has-text("${evalName}")`).first();
  let attempts = 0;
  while (attempts < 10) {
    if (await evalLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      break;
    }
    attempts++;
    // Reload the page to get fresh data
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    // Try search again after reload
    if (await searchBox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchBox.fill(searchText);
      await page.waitForTimeout(1000);
    }
  }
  await expect(evalLink).toBeVisible({ timeout: 5000 });
  await evalLink.click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
}

// Configure tests to run serially to avoid parallel execution conflicts
test.describe.configure({ mode: 'serial' });

test.describe('Report Interface', () => {

  test('Report Display', async ({ citeAuthenticatedPage: page }) => {

    await createActiveEvalWithMoveAndTeam(page, DISPLAY_TEAM_TYPE, DISPLAY_EVAL_NAME, 'Display Test Team', 'DTT');
    await navigateToEvaluation(page, DISPLAY_EVAL_NAME, 'E2E Display');

    // Click the SubmissionReview (Report) button
    const reportButton = page.locator('button[title="SubmissionReview"]');
    await expect(reportButton).toBeVisible({ timeout: 10000 });
    await reportButton.click();
    await page.waitForTimeout(2000);

    // Verify the report interface loads with the heading
    const reportHeading = page.locator('h2').filter({ hasText: /Responses for/ });
    await expect(reportHeading).toBeVisible({ timeout: 10000 });
    await expect(reportHeading).toContainText(DISPLAY_EVAL_NAME);

    // Verify the toggle and print buttons are present
    const toggleButton = page.locator('button[title="Toggle between user and team scores"]');
    await expect(toggleButton).toBeVisible({ timeout: 5000 });

    const printButton = page.locator('button[title="Print Submission Review"]');
    await expect(printButton).toBeVisible({ timeout: 5000 });

    // Cleanup
    await deleteEvaluationByName(page, DISPLAY_EVAL_NAME);
    await deleteTeamTypeByName(page, DISPLAY_TEAM_TYPE);
  });

  test('Export Report Data', async ({ citeAuthenticatedPage: page }) => {

    await createActiveEvalWithMoveAndTeam(page, EXPORT_TEAM_TYPE, EXPORT_EVAL_NAME, 'Export Test Team', 'ETT');
    await navigateToEvaluation(page, EXPORT_EVAL_NAME, 'E2E Export');

    // Click the Aggregate Report button
    const aggregateButton = page.locator('button[title="Aggregate Report"]');
    await expect(aggregateButton).toBeVisible({ timeout: 10000 });
    await aggregateButton.click();
    await page.waitForTimeout(2000);

    // Verify the aggregate report is displayed
    const reportHeading = page.locator('h2').filter({ hasText: /Submissions Report/ });
    await expect(reportHeading).toBeVisible({ timeout: 10000 });

    // Verify the Print button is visible
    const printButton = page.locator('button[title="Print Submission Review"]');
    await expect(printButton).toBeVisible({ timeout: 5000 });
    await expect(printButton).toBeEnabled({ timeout: 5000 });

    // Stub window.print to prevent the browser print dialog.
    // The component calls: replace body -> window.print() -> location.reload()
    // After reload the page returns to the home page.
    await page.evaluate(() => { window.print = () => {}; });

    await printButton.click();

    // The component triggers location.reload() after print, which navigates back
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
    await page.waitForTimeout(2000);

    // After reload, page returns to the CITE app (confirms the print flow completed)
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 15000 });

    // Cleanup
    await deleteEvaluationByName(page, EXPORT_EVAL_NAME);
    await deleteTeamTypeByName(page, EXPORT_TEAM_TYPE);
  });

  test('View Team Comparison - Toggle User/Team Scores', async ({ citeAuthenticatedPage: page }) => {

    await createActiveEvalWithMoveAndTeam(page, COMPARISON_TEAM_TYPE, COMPARISON_EVAL_NAME, 'Comparison Test Team', 'CTT');
    await navigateToEvaluation(page, COMPARISON_EVAL_NAME, 'E2E Comparison');

    // Click the Aggregate Report button
    const aggregateButton = page.locator('button[title="Aggregate Report"]');
    await expect(aggregateButton).toBeVisible({ timeout: 10000 });
    await aggregateButton.click();
    await page.waitForTimeout(2000);

    // Verify the aggregate report is displayed
    const reportHeading = page.locator('h2').filter({ hasText: /Submissions Report/ });
    await expect(reportHeading).toBeVisible({ timeout: 10000 });

    // Toggle between user and team scores
    const toggleButton = page.locator('button[title="Toggle between user and team scores"]');
    await expect(toggleButton).toBeVisible({ timeout: 5000 });

    await expect(reportHeading).toContainText('User', { timeout: 5000 });

    await toggleButton.click();
    await page.waitForTimeout(1000);
    await expect(reportHeading).toContainText('Team', { timeout: 5000 });

    await toggleButton.click();
    await page.waitForTimeout(1000);
    await expect(reportHeading).toContainText('User', { timeout: 5000 });

    // Cleanup
    await deleteEvaluationByName(page, COMPARISON_EVAL_NAME);
    await deleteTeamTypeByName(page, COMPARISON_TEAM_TYPE);
  });

});
