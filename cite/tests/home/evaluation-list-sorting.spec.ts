// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { createEvaluation, deleteEvaluationByName, navigateToAdminSection } from '../../test-helpers';

const TEST_EVAL_ALPHA = 'E2E Sort Alpha';
const TEST_EVAL_BETA = 'E2E Sort Beta';

async function createEvalWithTeamMember(page: import('@playwright/test').Page, evalName: string, teamName: string, teamShort: string) {
  await createEvaluation(page, evalName);

  await navigateToAdminSection(page, 'Evaluations');
  await page.waitForTimeout(2000);

  const evalRow = page.locator('tbody tr').filter({ hasText: evalName }).first();
  await expect(evalRow).toBeVisible({ timeout: 15000 });
  await evalRow.click();
  await page.waitForTimeout(2000);

  // Expand Teams panel and add a team
  const teamsPanel = page.locator('mat-expansion-panel').filter({ hasText: 'Teams' }).first();
  await expect(teamsPanel).toBeVisible({ timeout: 10000 });
  await teamsPanel.locator('mat-expansion-panel-header').click();
  await page.waitForTimeout(1000);

  const addTeamButton = teamsPanel.locator('button[title="Add Team"]');
  await expect(addTeamButton).toBeVisible({ timeout: 5000 });
  await addTeamButton.click();

  const teamDialog = page.getByRole('dialog');
  await expect(teamDialog).toBeVisible({ timeout: 5000 });

  await teamDialog.getByRole('textbox').first().fill(teamName);
  await teamDialog.getByRole('textbox').nth(1).fill(teamShort);

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

  // Expand the team to reveal membership UI
  const teamRow = teamsPanel.locator('mat-expansion-panel-header').filter({ hasText: teamName });
  await expect(teamRow).toBeVisible({ timeout: 10000 });
  await teamRow.click();
  await page.waitForTimeout(2000);

  // Add Admin User as team member
  const usersSection = teamsPanel.locator('app-admin-team-memberships, app-admin-team-membership-list');
  await expect(usersSection.first()).toBeVisible({ timeout: 10000 });

  const adminRow = usersSection.locator('tr').filter({ hasText: 'Admin User' }).first();
  await expect(adminRow).toBeVisible({ timeout: 15000 });
  const addButton = adminRow.locator('button').filter({ has: page.locator('mat-icon[fonticon*="plus"]') });
  await expect(addButton).toBeVisible({ timeout: 5000 });
  await addButton.click();
  await page.waitForTimeout(2000);
}

test.describe('Home Page and Evaluation List', () => {

  test('Evaluation List Sorting', async ({ citeAuthenticatedPage: page }) => {

    // 1. Create two evaluations via admin UI with team memberships
    await createEvalWithTeamMember(page, TEST_EVAL_ALPHA, 'Sort Alpha Team', 'SAT');
    await createEvalWithTeamMember(page, TEST_EVAL_BETA, 'Sort Beta Team', 'SBT');

    // 2. Navigate to home page
    await page.goto(Services.Cite.UI);
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });

    const myEvalsHeading = page.locator('text=My Evaluations');
    await expect(myEvalsHeading).toBeVisible({ timeout: 10000 });

    // 3. Wait for evaluation rows to load
    const rows = page.locator('mat-row, tbody tr').filter({ hasNot: page.locator('th') });
    await expect(rows.first()).toBeVisible({ timeout: 15000 });

    // 4. Click on the 'Name' column header to sort ascending
    const nameHeader = page.locator('th:has-text("Name"), mat-header-cell:has-text("Name"), [mat-sort-header]:has-text("Name")').first();
    await nameHeader.click();
    await page.waitForTimeout(500);

    // Verify sort indicator appears
    const sortIndicator = nameHeader.locator('.mat-sort-header-arrow, mat-sort-header-arrow');
    await expect(sortIndicator).toBeVisible({ timeout: 5000 });

    // 5. Click again to sort descending
    await nameHeader.click();
    await page.waitForTimeout(500);
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    await deleteEvaluationByName(page, TEST_EVAL_ALPHA);
    await deleteEvaluationByName(page, TEST_EVAL_BETA);
  });
});
