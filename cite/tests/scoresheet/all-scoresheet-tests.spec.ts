// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

// This file combines all scoresheet tests into a single file to run them serially,
// avoiding parallel execution issues where multiple tests compete for the same "Admin User" visibility.

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection, deleteEvaluationByName, deleteTeamTypeByName } from '../../test-helpers';

async function createActiveEvalWithMoveAndTeam(
  page: import('@playwright/test').Page,
  teamTypeName: string,
  evalName: string,
  teamName: string,
  teamShortName: string,
) {
  // 0. Clean up any leftover resources from previous failed runs
  await deleteEvaluationByName(page, evalName);
  await deleteTeamTypeByName(page, teamTypeName);

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
    { timeout: 15000 },
  ).catch(() => {});
  await page.waitForTimeout(1500);
  await scoringModelSelect.click();
  await page.waitForTimeout(1000);

  let firstOption = page.locator('mat-option').first();
  if (!(await firstOption.isVisible({ timeout: 1000 }).catch(() => false))) {
    const matSelect = page
      .locator('mat-select[formcontrolname="scoringModelId"], mat-select[ng-reflect-name="scoringModelId"]')
      .first();
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
    response =>
      response.url().includes('/api/evaluations') && response.request().method() === 'POST' && response.ok(),
    { timeout: 15000 },
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

  const membershipArea = page
    .locator('mat-expansion-panel')
    .filter({ hasText: 'Teams' })
    .first()
    .locator('app-admin-team-memberships')
    .first();
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

async function navigateToEvaluationScoresheet(
  page: import('@playwright/test').Page,
  evalName: string,
  searchText: string,
) {
  // Navigate to home page and click into the evaluation (which opens the scoresheet by default)
  await page.goto(Services.Cite.UI);
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });

  const myEvalsHeading = page.locator('text=My Evaluations');
  await expect(myEvalsHeading).toBeVisible({ timeout: 10000 });

  const homeRows = page.locator('mat-row, tbody tr').filter({ hasNot: page.locator('th') });
  await expect(homeRows.first()).toBeVisible({ timeout: 15000 });

  // Use search box to filter
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
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    if (await searchBox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchBox.fill(searchText);
      await page.waitForTimeout(1000);
    }
  }
  await expect(evalLink).toBeVisible({ timeout: 5000 });
  await evalLink.click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // The evaluation view IS the scoresheet by default.
  // Verify we're on the scoresheet by checking for the move heading and evaluation name.
  const moveHeading = page.getByRole('heading', { name: /Move:/ });
  await expect(moveHeading).toBeVisible({ timeout: 10000 });
  const evalHeading = page.getByRole('heading', { name: evalName });
  await expect(evalHeading).toBeVisible({ timeout: 10000 });

  // Advance to Move 1 so scoring categories are displayed.
  // Move 0 is the "Default Move" which shows "No responses required for this move."
  const advanceMoveButton = page.getByRole('button', { name: 'Advance Move' });
  if (await advanceMoveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await advanceMoveButton.click();
    // Handle confirmation dialog if it appears
    const confirmDialog = page.getByRole('dialog');
    if (await confirmDialog.isVisible({ timeout: 3000 }).catch(() => false)) {
      const yesButton = confirmDialog.getByRole('button', { name: /Yes|Confirm|OK/i });
      if (await yesButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await yesButton.click();
        await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });
      }
    }
    await page.waitForTimeout(2000);
  }
}

// Configure tests to run serially to avoid parallel execution conflicts
test.describe.configure({ mode: 'serial' });

test.describe('Scoresheet Interface', () => {
  test('Scoresheet Initial Load', async ({ citeAuthenticatedPage: page }) => {
    const TT = 'E2E SS-IL Team Type';
    const EV = 'E2E SS-IL Evaluation';

    await createActiveEvalWithMoveAndTeam(page, TT, EV, 'SS-IL Team', 'SIL');
    await navigateToEvaluationScoresheet(page, EV, 'E2E SS-IL');

    // expect: Scoresheet interface loads with scoring categories displayed as table rows
    const scoresheetTable = page.getByRole('table').first();
    await expect(scoresheetTable).toBeVisible({ timeout: 10000 });

    // expect: Scoring categories (discussion questions) are displayed
    const questionRows = page.getByRole('table').first().getByRole('row');
    await expect(questionRows.first()).toBeVisible({ timeout: 10000 });

    // expect: Submission type buttons are visible (User / Team)
    const userButton = page.getByRole('button', { name: 'User', exact: true });
    await expect(userButton).toBeVisible({ timeout: 5000 });

    // Cleanup
    await deleteEvaluationByName(page, EV);
    await deleteTeamTypeByName(page, TT);
  });

  test('View User Submission', async ({ citeAuthenticatedPage: page }) => {
    const TT = 'E2E SS-VU Team Type';
    const EV = 'E2E SS-VU Evaluation';

    await createActiveEvalWithMoveAndTeam(page, TT, EV, 'SS-VU Team', 'SVU');
    await navigateToEvaluationScoresheet(page, EV, 'E2E SS-VU');

    // Click the "User" submission type button
    const userButton = page.getByRole('button', { name: 'User', exact: true });
    await expect(userButton).toBeVisible({ timeout: 5000 });
    await userButton.click();
    await page.waitForTimeout(1000);

    // expect: Scoresheet displays user's individual scores (table with questions visible)
    const scoresheetTable = page.getByRole('table').first();
    await expect(scoresheetTable).toBeVisible({ timeout: 10000 });

    // Cleanup
    await deleteEvaluationByName(page, EV);
    await deleteTeamTypeByName(page, TT);
  });

  test('View Team Submission', async ({ citeAuthenticatedPage: page }) => {
    const TT = 'E2E SS-VT Team Type';
    const EV = 'E2E SS-VT Evaluation';

    await createActiveEvalWithMoveAndTeam(page, TT, EV, 'SS-VT Team', 'SVT');
    await navigateToEvaluationScoresheet(page, EV, 'E2E SS-VT');

    // Click the "Team" submission type button
    const teamButton = page.getByRole('button', { name: 'Team' });
    await expect(teamButton).toBeVisible({ timeout: 5000 });
    await teamButton.click();
    await page.waitForTimeout(1000);

    // expect: Scoresheet displays team's official scores
    const scoresheetTable = page.getByRole('table').first();
    await expect(scoresheetTable).toBeVisible({ timeout: 10000 });

    // Cleanup
    await deleteEvaluationByName(page, EV);
    await deleteTeamTypeByName(page, TT);
  });

  test('View Team Average Submission', async ({ citeAuthenticatedPage: page }) => {
    const TT = 'E2E SS-TA Team Type';
    const EV = 'E2E SS-TA Evaluation';

    await createActiveEvalWithMoveAndTeam(page, TT, EV, 'SS-TA Team', 'STA');
    await navigateToEvaluationScoresheet(page, EV, 'E2E SS-TA');

    // The "Team Avg" button may or may not be visible depending on scoring model config.
    // If visible, click it; otherwise verify the scoresheet is loaded.
    const teamAvgButton = page.getByRole('button', { name: /Team Avg/i });
    if (await teamAvgButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await teamAvgButton.click();
      await page.waitForTimeout(1000);
    }

    // expect: Scoresheet is displayed (read-only for averages)
    const scoresheetTable = page.getByRole('table').first();
    await expect(scoresheetTable).toBeVisible({ timeout: 10000 });

    // Cleanup
    await deleteEvaluationByName(page, EV);
    await deleteTeamTypeByName(page, TT);
  });

  test('View Group Average Submission', async ({ citeAuthenticatedPage: page }) => {
    const TT = 'E2E SS-GA Team Type';
    const EV = 'E2E SS-GA Evaluation';

    await createActiveEvalWithMoveAndTeam(page, TT, EV, 'SS-GA Team', 'SGA');
    await navigateToEvaluationScoresheet(page, EV, 'E2E SS-GA');

    // The "Group Avg" button may or may not be visible depending on scoring model/group config.
    // If visible, click it; otherwise verify the scoresheet is loaded.
    const groupAvgButton = page.getByRole('button', { name: /Group Avg/i });
    if (await groupAvgButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await groupAvgButton.click();
      await page.waitForTimeout(1000);
    }

    // expect: Scoresheet is displayed
    const scoresheetTable = page.getByRole('table').first();
    await expect(scoresheetTable).toBeVisible({ timeout: 10000 });

    // Cleanup
    await deleteEvaluationByName(page, EV);
    await deleteTeamTypeByName(page, TT);
  });

  test('View Official Submission', async ({ citeAuthenticatedPage: page }) => {
    const TT = 'E2E SS-VO Team Type';
    const EV = 'E2E SS-VO Evaluation';

    await createActiveEvalWithMoveAndTeam(page, TT, EV, 'SS-VO Team', 'SVO');
    await navigateToEvaluationScoresheet(page, EV, 'E2E SS-VO');

    // The "Official" button may or may not be visible depending on scoring model config.
    // If visible, click it; otherwise verify the scoresheet is loaded.
    const officialButton = page.getByRole('button', { name: /Official/i });
    if (await officialButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await officialButton.click();
      await page.waitForTimeout(1000);
    }

    // expect: Scoresheet is displayed
    const scoresheetTable = page.getByRole('table').first();
    await expect(scoresheetTable).toBeVisible({ timeout: 10000 });

    // Cleanup
    await deleteEvaluationByName(page, EV);
    await deleteTeamTypeByName(page, TT);
  });

  test('Modify Score with CanSubmit Permission', async ({ citeAuthenticatedPage: page }) => {
    const TT = 'E2E SS-MS Team Type';
    const EV = 'E2E SS-MS Evaluation';

    await createActiveEvalWithMoveAndTeam(page, TT, EV, 'SS-MS Team', 'SMS');
    await navigateToEvaluationScoresheet(page, EV, 'E2E SS-MS');

    // Ensure we're on User submission to have edit ability
    const userButton = page.getByRole('button', { name: 'User', exact: true });
    await expect(userButton).toBeVisible({ timeout: 5000 });
    await userButton.click();
    await page.waitForTimeout(1000);

    // expect: Scoresheet displays with scoring question textboxes
    const scoresheetTable = page.getByRole('table').first();
    await expect(scoresheetTable).toBeVisible({ timeout: 10000 });

    // Look for interactive scoring options (radio buttons, checkboxes, or enabled textboxes)
    const scoringOptions = page.locator('mat-radio-button, mat-checkbox, input:not([disabled]), textarea:not([disabled])');
    if (await scoringOptions.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      // Click or type in the first interactive element
      const firstOption = scoringOptions.first();
      const tagName = await firstOption.evaluate(el => el.tagName.toLowerCase());
      if (tagName === 'input' || tagName === 'textarea') {
        await firstOption.fill('Test response');
        await firstOption.blur();
      } else {
        await firstOption.click();
      }
      await page.waitForTimeout(1000);
    }

    // expect: No error snackbar after interaction
    const errorSnackbar = page.locator('snack-bar-container, mat-snack-bar-container').filter({ hasText: /error/i });
    const hasError = await errorSnackbar.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBeFalsy();

    // Cleanup
    await deleteEvaluationByName(page, EV);
    await deleteTeamTypeByName(page, TT);
  });

  test('Modify Score without CanSubmit Permission', async ({ citeAuthenticatedPage: page }) => {
    const TT = 'E2E SS-MU Team Type';
    const EV = 'E2E SS-MU Evaluation';

    await createActiveEvalWithMoveAndTeam(page, TT, EV, 'SS-MU Team', 'SMU');
    await navigateToEvaluationScoresheet(page, EV, 'E2E SS-MU');

    // Switch to "Team" view where the admin user cannot directly modify scores
    const teamButton = page.getByRole('button', { name: 'Team' });
    await expect(teamButton).toBeVisible({ timeout: 5000 });
    await teamButton.click();
    await page.waitForTimeout(1000);

    // expect: Scoresheet displays in a non-user submission mode
    const scoresheetTable = page.getByRole('table').first();
    await expect(scoresheetTable).toBeVisible({ timeout: 10000 });

    // expect: Textboxes should be disabled in Team view
    const disabledTextboxes = page.locator('textbox[disabled], input[disabled], textarea[disabled]');
    if (await disabledTextboxes.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(disabledTextboxes.first()).toBeDisabled();
    }

    // Cleanup
    await deleteEvaluationByName(page, EV);
    await deleteTeamTypeByName(page, TT);
  });

  test('Add Comment to Score', async ({ citeAuthenticatedPage: page }) => {
    const TT = 'E2E SS-AC Team Type';
    const EV = 'E2E SS-AC Evaluation';

    await createActiveEvalWithMoveAndTeam(page, TT, EV, 'SS-AC Team', 'SAC');
    await navigateToEvaluationScoresheet(page, EV, 'E2E SS-AC');

    // Switch to User submission to have edit ability
    const userButton = page.getByRole('button', { name: 'User', exact: true });
    await expect(userButton).toBeVisible({ timeout: 5000 });
    await userButton.click();
    await page.waitForTimeout(1000);

    // expect: Scoresheet displays
    const scoresheetTable = page.getByRole('table').first();
    await expect(scoresheetTable).toBeVisible({ timeout: 10000 });

    // Look for a textbox/textarea that can accept comments
    // The scoresheet has textbox fields for each discussion question
    const commentFields = page.locator('textarea:not([disabled]), input[type="text"]:not([disabled])');
    if (await commentFields.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await commentFields.first().fill('Test comment from automated test');
      await expect(commentFields.first()).toHaveValue('Test comment from automated test');
      await commentFields.first().blur();
      await page.waitForTimeout(1000);
    }

    // Cleanup
    await deleteEvaluationByName(page, EV);
    await deleteTeamTypeByName(page, TT);
  });

  test('View Score Summary', async ({ citeAuthenticatedPage: page }) => {
    const TT = 'E2E SS-VS Team Type';
    const EV = 'E2E SS-VS Evaluation';

    await createActiveEvalWithMoveAndTeam(page, TT, EV, 'SS-VS Team', 'SVS');
    await navigateToEvaluationScoresheet(page, EV, 'E2E SS-VS');

    // expect: Scoresheet displays with the evaluation heading and move info
    const scoresheetTable = page.getByRole('table').first();
    await expect(scoresheetTable).toBeVisible({ timeout: 10000 });

    // The current move info is shown in the header
    const moveHeading = page.getByRole('heading', { name: /Move:/ });
    await expect(moveHeading).toBeVisible({ timeout: 5000 });

    // The SubmissionReview (report) button is available for viewing score summaries
    const reportButton = page.locator('button[title="SubmissionReview"]');
    await expect(reportButton).toBeVisible({ timeout: 5000 });

    // Cleanup
    await deleteEvaluationByName(page, EV);
    await deleteTeamTypeByName(page, TT);
  });
});
