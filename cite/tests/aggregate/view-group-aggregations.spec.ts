// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection, createEvaluation, deleteEvaluationByName } from '../../test-helpers';

// These tests share backend state (admin user memberships, team types) with
// other aggregate tests. Running them serially avoids SignalR/session races
// that produce an empty membership list or stale team data.
test.describe.configure({ mode: 'serial' });

test.describe('Aggregate Interface', () => {

  const TEST_EVAL_NAME = 'Group Aggregation Test Eval';
  const TEST_TEAM_NAME = 'Group Agg Test Team';
  const TEST_TEAM_SHORT = 'GAT';

  test.beforeEach(async ({ citeAuthenticatedPage: page }) => {
    // Clean up any existing test evaluations first
    await deleteEvaluationByName(page, TEST_EVAL_NAME);
  });

  test('View Group Aggregations', async ({ citeAuthenticatedPage: page }) => {

    // 1. Create an evaluation via admin
    await createEvaluation(page, TEST_EVAL_NAME);

    // 2. Navigate to evaluations admin and expand the evaluation row
    await navigateToAdminSection(page, 'Evaluations');
    const evalRow = page.locator('tbody tr').filter({ hasText: TEST_EVAL_NAME }).first();
    await expect(evalRow).toBeVisible({ timeout: 15000 });
    await evalRow.click();

    // Wait for the expansion detail row with the inner expansion panels.
    // Target the mat-expansion-panel-header containing the "Teams" heading.
    const teamsPanelHeader = page.locator('mat-expansion-panel-header')
      .filter({ has: page.locator('h4', { hasText: 'Teams' }) });
    await expect(teamsPanelHeader).toBeVisible({ timeout: 10000 });

    // 3. Expand the "Teams" panel; poll aria-expanded in case the first click is missed
    // (Angular Material animations can swallow a click during expansion/collapse).
    await expect(async () => {
      const isExpanded = (await teamsPanelHeader.getAttribute('aria-expanded')) === 'true';
      if (!isExpanded) {
        await teamsPanelHeader.click();
        await page.waitForTimeout(750);
      }
      expect(await teamsPanelHeader.getAttribute('aria-expanded')).toBe('true');
    }).toPass({ timeout: 20000, intervals: [500, 1000, 2000] });

    // 4. Add a team: click the "Add Team" button (using title attribute).
    // The button exists in the DOM while the panel is collapsed but is visibility:hidden,
    // so wait specifically for it to become visible rather than racing the animation.
    const addTeamButton = page.locator('button[title="Add Team"]');
    await expect(addTeamButton).toBeVisible({ timeout: 15000 });
    await addTeamButton.click();

    // 5. Fill in team dialog
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const nameField = dialog.getByPlaceholder('Name (required)', { exact: true });
    await nameField.fill(TEST_TEAM_NAME);
    await nameField.blur();

    const shortNameField = dialog.getByPlaceholder('Short Name (required)', { exact: true });
    await shortNameField.fill(TEST_TEAM_SHORT);
    await shortNameField.blur();

    // Select first team type
    const teamTypeSelect = dialog.locator('mat-select');
    await teamTypeSelect.click();
    const firstOption = page.locator('mat-option').first();
    await expect(firstOption).toBeVisible({ timeout: 10000 });
    await firstOption.click();
    await page.waitForTimeout(500);

    // Save team
    const saveButton = dialog.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled({ timeout: 10000 });

    // Wait for team creation API call
    const teamCreatePromise = page.waitForResponse(
      response => response.url().includes('/api/teams') && response.request().method() === 'POST' && response.ok(),
      { timeout: 15000 }
    ).catch(() => null);

    await saveButton.click();
    const teamResponse = await teamCreatePromise;
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // Wait for the team to be created and the UI to update
    await page.waitForTimeout(2000);

    // 6. The CITE UI doesn't always refresh the team list via SignalR in dev mode,
    // so explicitly re-navigate to the evaluations admin to get a fresh state, then
    // re-expand the evaluation row and the Teams panel.
    await navigateToAdminSection(page, 'Evaluations');
    const evalRowAfter = page.locator('tbody tr').filter({ hasText: TEST_EVAL_NAME }).first();
    await expect(evalRowAfter).toBeVisible({ timeout: 15000 });
    await evalRowAfter.click();
    await page.waitForTimeout(1000);

    const teamsPanelHeaderAfter = page.locator('mat-expansion-panel-header')
      .filter({ has: page.locator('h4', { hasText: 'Teams' }) });
    await expect(teamsPanelHeaderAfter).toBeVisible({ timeout: 10000 });

    await expect(async () => {
      const isExpanded = (await teamsPanelHeaderAfter.getAttribute('aria-expanded')) === 'true';
      if (!isExpanded) {
        await teamsPanelHeaderAfter.click();
        await page.waitForTimeout(750);
      }
      expect(await teamsPanelHeaderAfter.getAttribute('aria-expanded')).toBe('true');
    }).toPass({ timeout: 20000, intervals: [500, 1000, 2000] });
    await page.waitForTimeout(1000);

    // Expand the newly created team to see memberships.
    // The team row inside app-admin-teams is itself a mat-expansion-panel-header,
    // whose accessible name combines the short name and name.
    const teamButton = page.getByRole('button', { name: new RegExp(`${TEST_TEAM_SHORT}.*${TEST_TEAM_NAME}`) }).first();
    await expect(teamButton).toBeVisible({ timeout: 15000 });
    await teamButton.scrollIntoViewIfNeeded();
    await expect(async () => {
      const isExpanded = (await teamButton.getAttribute('aria-expanded')) === 'true';
      if (!isExpanded) {
        await teamButton.click();
        await page.waitForTimeout(750);
      }
      expect(await teamButton.getAttribute('aria-expanded')).toBe('true');
    }).toPass({ timeout: 15000, intervals: [500, 1000, 2000] });
    await page.waitForTimeout(1500);

    // 7. Add admin user as team member — find the "+" button next to "Admin User" in the non-members list
    const membershipList = page.locator('app-admin-team-membership-list');
    await expect(membershipList).toBeVisible({ timeout: 10000 });

    // Poll for an add button to appear and click it in one operation.
    // The plus icon's fonticon varies between "mdi-plus-circle" and
    // "mdi-plus-circle-outline" depending on Angular Material version.
    const addAdminBtn = membershipList.locator('button[mattooltip*="Add Admin"]').first();
    const anyAddBtn = membershipList
      .locator('button:has(mat-icon[fonticon^="mdi-plus-circle"])')
      .first();

    await expect(async () => {
      if (await addAdminBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await addAdminBtn.click({ timeout: 2000 });
        return;
      }
      if (await anyAddBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await anyAddBtn.click({ timeout: 2000 });
        return;
      }
      throw new Error('No add button visible yet');
    }).toPass({ timeout: 20000, intervals: [500, 1000, 2000] });

    // Wait for the user to be added
    await page.waitForTimeout(1500);

    // 8. Navigate to home page — evaluation should now appear in "My Evaluations"
    await page.goto(Services.Cite.UI, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(Services.Cite.UI.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), { timeout: 10000 });

    const evaluationRows = page.locator('mat-row').filter({ hasText: TEST_EVAL_NAME });
    await expect(evaluationRows.first()).toBeVisible({ timeout: 15000 });

    // 9. Click on the evaluation
    await evaluationRows.first().click();
    await page.waitForLoadState('domcontentloaded');

    // 10. Look for evaluation content (dashboard, tabs, etc.)
    const evaluationContent = page.locator('app-evaluation-info, mat-tab-group, [class*="evaluation"], [class*="dashboard"]').first();
    await expect(evaluationContent).toBeVisible({ timeout: 15000 });
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    await deleteEvaluationByName(page, TEST_EVAL_NAME);
  });
});
