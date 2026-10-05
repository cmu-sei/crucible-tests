// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, ensureScoringModelExists, ensureTeamTypeExists, purgeStaleEvaluations, CITE_THEMES, setCiteTheme } from '../../fixtures';
import { navigateToAdminSection, createEvaluation, deleteEvaluationByName, findAdminRowByName } from '../../test-helpers';

// These tests share backend state (admin user memberships, team types) with
// other aggregate tests. Running them serially avoids SignalR/session races
// that produce an empty membership list or stale team data.
const SHARED_TEAM_TYPE = 'E2E Shared Team Type';

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Aggregate Interface`, () => {
    // Serial per theme, so a failure in one theme doesn't skip the other.
    test.describe.configure({ mode: 'serial' });

    const TEST_EVAL_NAME = 'Group Aggregation Test Eval';
    const TEST_TEAM_NAME = 'Group Agg Test Team';
    const TEST_TEAM_SHORT = 'GAT';

    // Purge only this file's own evaluations: a broader purge deletes the
    // evaluations other files are using on the other worker.
    test.beforeAll(async () => {
      await purgeStaleEvaluations([TEST_EVAL_NAME]);
    });

    test.beforeEach(async ({ citeAuthenticatedPage: page }) => {
      // Ensure a scoring model and a team type exist so the Add Evaluation and
      // Add Team dialog dropdowns are populated on a clean database.
      await ensureScoringModelExists();
      await ensureTeamTypeExists(SHARED_TEAM_TYPE);
      // Clean up any existing test evaluations first
      await deleteEvaluationByName(page, TEST_EVAL_NAME);
    });

    test('View Group Aggregations', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      // 1. Create an evaluation via admin
      await createEvaluation(page, TEST_EVAL_NAME);

      // 2. Navigate to evaluations admin and expand the evaluation row
      await navigateToAdminSection(page, 'Evaluations');
      const evalRow = await findAdminRowByName(page, TEST_EVAL_NAME);
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

      // Select the shared team type. Not the first option: other specs' temporary team
      // types are deleted while this one runs, and saving against one gives a 500.
      const teamTypeSelect = dialog.locator('mat-select');
      await teamTypeSelect.click();
      const teamTypeOption = page.getByRole('option', { name: SHARED_TEAM_TYPE, exact: true }).first(); // parallel workers can each seed one on a fresh DB
      await expect(teamTypeOption).toBeVisible({ timeout: 10000 });
      await teamTypeOption.click();
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
      const evalRowAfter = await findAdminRowByName(page, TEST_EVAL_NAME);
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

      // Click the add button on Admin User's own row. `matTooltip="Add {{ model.name }}"`
      // is a property binding, so there is no `mattooltip` attribute to select on, and
      // the first add button in the list belongs to whichever user sorts first.
      // The non-member list is paginated and other suites leave users behind, so Admin
      // User may not be on page 1. Filter it first (the filter runs on keyup, so type).
      await membershipList.getByPlaceholder('Search').pressSequentially('Admin User');
      // The table re-renders as the filter applies and as memberships refresh, which can
      // detach the button mid-click. Retry until Admin User is actually a member.
      const adminRow = membershipList.locator('tr').filter({ hasText: 'Admin User' }).first();
      const adminMember = page.locator('app-admin-team-member-list tr').filter({ hasText: 'Admin User' }).first();
      await expect(async () => {
        if (await adminMember.isVisible()) return;
        await adminRow.getByRole('button').last().click({ timeout: 3000 });
        await expect(adminMember).toBeVisible({ timeout: 3000 });
      }).toPass({ timeout: 30000, intervals: [500, 1000, 2000] });

      // 8. Navigate to home page — evaluation should now appear in "My Evaluations"
      await page.goto(Services.Cite.UI, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(Services.Cite.UI.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), { timeout: 10000 });

      // Filter "My Evaluations" to this evaluation: the list shows 10 per page, so it
      // may not be on page 1. The filter runs on keyup, so type rather than fill.
      // A just-added team membership doesn't always show up on the first load, so
      // reload and re-filter until the row appears.
      const evaluationRows = page.locator('mat-row').filter({ hasText: TEST_EVAL_NAME });
      await expect(async () => {
        await page.goto(Services.Cite.UI, { waitUntil: 'domcontentloaded' });
        await page.getByRole('textbox', { name: 'Search' }).pressSequentially(TEST_EVAL_NAME);
        await expect(evaluationRows.first()).toBeVisible({ timeout: 10000 });
      }).toPass({ timeout: 45000, intervals: [1000, 2000, 5000] });

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
}
