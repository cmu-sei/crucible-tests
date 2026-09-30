// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, seedCompleteEvaluation, cleanupCompleteEvaluation } from '../../fixtures';
import { navigateToAdminSection, waitForAdminListLoad } from '../../test-helpers';

/**
 * Adds a team through the evaluation's inline Teams panel — the UI path, not the API.
 *
 * "Manage Evaluation Teams" seeds its team over the API and only reads the panel back,
 * so nothing covered the Add Team dialog until this spec. That gap hid a real 400:
 * the new-team object omitted `hideScoresheet`, the dialog's bare
 * `[data.team.hideScoresheet]` control resolved to `null` via the FormControl
 * constructor default, and the API refused `null` for a non-nullable bool. Every
 * failure surfaced as a "Bad Request" bottom sheet rather than a visible field error,
 * so the assertions below check for that sheet explicitly.
 */
test.describe('Administration - Evaluations', () => {

  let seedData: { scoringModelId: string; evaluationId: string; teamTypeId: string } | null = null;

  test('Add Evaluation Team', async ({ citeAuthenticatedPage: page }) => {
    const evalName = `E2E AddTeam Evaluation ${Date.now()}`;
    const teamName = `E2E AddTeam Team ${Date.now()}`;
    const teamShortName = 'EAT';

    // 1. Seed an evaluation (with a team type to pick in the dialog) via the API
    seedData = await seedCompleteEvaluation(evalName, 0);

    // 2. Open the evaluation from the admin list
    await navigateToAdminSection(page, 'Evaluations');
    await waitForAdminListLoad(page, '/api/evaluations', true);

    const searchBox = page
      .locator('input[placeholder="Search"], input[type="search"], input[aria-label="Search"]')
      .first();
    await expect(searchBox).toBeVisible({ timeout: 5000 });
    await searchBox.clear();
    await searchBox.fill(evalName);
    await page.waitForTimeout(1000);

    const evalRow = page.locator('tbody tr').filter({ hasText: evalName }).first();
    await expect(evalRow).toBeVisible({ timeout: 10000 });
    await evalRow.click();
    await page.waitForTimeout(1000);

    // 3. Expand the Teams panel
    const teamsPanel = page.locator('mat-expansion-panel').filter({ hasText: 'Teams' }).first();
    await expect(teamsPanel).toBeVisible({ timeout: 10000 });
    await teamsPanel.locator('mat-expansion-panel-header').first().click();
    await page.waitForTimeout(1000);

    // 4. Fill in the Add Team dialog, leaving Hide Scoresheet untouched
    const addTeamButton = teamsPanel.locator('button[title="Add Team"]');
    await expect(addTeamButton).toBeVisible({ timeout: 5000 });
    await addTeamButton.click();

    const teamDialog = page.locator('mat-dialog-container');
    await expect(teamDialog).toBeVisible({ timeout: 5000 });
    await teamDialog.getByRole('textbox').first().fill(teamName);
    await teamDialog.getByRole('textbox').nth(1).fill(teamShortName);
    await teamDialog.getByRole('combobox', { name: 'Team Type' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('option', { name: `Team Type for ${evalName}` }).first().click();
    await page.waitForTimeout(500);

    const createResponse = page.waitForResponse(
      (r) => r.url().includes('/api/teams') && r.request().method() === 'POST',
      { timeout: 15000 }
    );
    await teamDialog.getByRole('button', { name: 'Save' }).click();

    // expect: The API accepts the new team
    expect((await createResponse).status()).toBe(201);

    // expect: The dialog closes and no error sheet is raised
    await expect(teamDialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('mat-bottom-sheet-container')).toHaveCount(0);

    // expect: The new team is listed in the panel
    const teamRow = teamsPanel.locator('mat-expansion-panel-header').filter({ hasText: teamName });
    await expect(teamRow).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async () => {
    if (seedData) {
      await cleanupCompleteEvaluation(seedData);
      seedData = null;
    }
  });
});
