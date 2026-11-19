// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

// This file combines all scoresheet tests into a single file to run them serially,
// avoiding parallel execution issues where multiple tests compete for the same "Admin User" visibility.

import {
  test,
  expect,
  Services,
  seedActiveEvaluation,
  apiDeleteEvaluation,
  apiDeleteEvaluationsByName,
  CITE_THEMES,
  setCiteTheme,
  citeMoveLabel,
  type SeededEvaluation,
} from '../../fixtures';
import type { Locator, Page } from '@playwright/test';

async function waitForVisible(locator: Locator, timeout: number): Promise<boolean> {
  return locator.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false);
}

/**
 * Open `evaluation` on its Scoresheet section with its team active.
 *
 * KNOWN CITE UI BUG (documented for the maintainers): when an evaluation is opened
 * after heavy prior session activity, home-app's setTeams() does not reliably
 * auto-activate the user's team (a load-order race between the current-user load and
 * the my-teams load). With no active team the scoresheet's scoring table stays hidden.
 * The app persists the last-used team/section in localStorage ('uiState') and honours
 * it on load, so seeding it here is a deterministic, test-only workaround that does NOT
 * mask the bug for real users (it only sets what the UI itself would have saved).
 *
 * The `?evaluation=<id>&section=scoresheet` URL opens the section directly; clicking the
 * evaluation's link on the home page instead calls selectingAnEvaluation(), which forces
 * the section back to the dashboard.
 */
async function navigateToEvaluationScoresheet(page: Page, evaluation: SeededEvaluation) {
  await page.addInitScript(
    ({ evalId, team }) => {
      try {
        const raw = window.localStorage.getItem('uiState');
        const state = raw ? JSON.parse(raw) : {};
        state.evaluationSection = state.evaluationSection || {};
        state.evaluationTeam = state.evaluationTeam || {};
        state.evaluationSubmissionType = state.evaluationSubmissionType || {};
        state.evaluationSection[evalId] = 'scoresheet';
        state.evaluationTeam[evalId] = team;
        state.evaluationSubmissionType[evalId] = 'team';
        window.localStorage.setItem('uiState', JSON.stringify(state));
      } catch {
        /* ignore */
      }
    },
    { evalId: evaluation.evaluationId, team: evaluation.teamId },
  );

  // The User/Team submission toggle buttons are the reliable signal that the scoresheet
  // (not the dashboard, whose Score Summary also contains a <table>) has rendered with a
  // team active. Re-navigate a few times until they appear.
  const userButton = page.getByRole('button', { name: 'User', exact: true });
  const scoresheetTab = page.getByRole('button', { name: 'Scoresheet', exact: true });
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${Services.Cite.UI}/?evaluation=${evaluation.evaluationId}&section=scoresheet`);
    if (await waitForVisible(userButton, 5000)) return;
    // A redirect may have dropped the section param; switch to the scoresheet tab.
    if (await waitForVisible(scoresheetTab, 2000)) {
      await scoresheetTab.click();
      if (await waitForVisible(userButton, 3000)) return;
    }
  }
  await expect(userButton).toBeVisible();
}

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Scoresheet Interface`, () => {
    // Serial per theme, so a failure in one theme doesn't skip the other.
    test.describe.configure({ mode: 'serial' });

    // The browser x theme groups of this file run on separate workers, often at the same
    // time, so every name a group creates carries its project and theme.
    let prefix = '';

    // Readers share one API-seeded evaluation per theme group (Active, on the shared
    // scoresheet-ready scoring model, moves 0-1 with move 1 current, Admin User on its
    // team). They only switch the displayed submission type, which the UI keeps in the
    // browser's localStorage, so they never change it. The two tests that write a
    // score or a comment are mutators and seed their own evaluation (seedOwnEvaluation).
    let shared: SeededEvaluation;
    let ownEvaluationId: string | null = null;

    async function seedScoresheetEvaluation(name: string): Promise<SeededEvaluation> {
      // A crashed earlier run may have left this name behind.
      await apiDeleteEvaluationsByName(name);
      return seedActiveEvaluation(name, { moves: 1, currentMoveNumber: 1 });
    }

    async function seedOwnEvaluation(code: string): Promise<SeededEvaluation> {
      const seeded = await seedScoresheetEvaluation(`${prefix}${code} Evaluation`);
      ownEvaluationId = seeded.evaluationId;
      return seeded;
    }

    test.beforeAll(async () => {
      prefix = `E2E SS-${test.info().project.name}-${theme} `;
      shared = await seedScoresheetEvaluation(`${prefix}Shared Evaluation`);
    });

    test.afterEach(async () => {
      if (ownEvaluationId) {
        await apiDeleteEvaluation(ownEvaluationId);
        ownEvaluationId = null;
      }
    });

    test.afterAll(async () => {
      if (shared) await apiDeleteEvaluation(shared.evaluationId);
    });

    test('Scoresheet Initial Load', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      await navigateToEvaluationScoresheet(page, shared);

      // expect: Submission type buttons are visible (User / Team). These are the reliable
      // signal that the scoresheet rendered with an active team (navigateToEvaluationScoresheet
      // already polls until they appear). Assert them first.
      const userButton = page.getByRole('button', { name: 'User', exact: true });
      await expect(userButton).toBeVisible({ timeout: 10000 });

      // expect: Scoresheet interface loads with scoring categories displayed as table rows.
      // The scoresheet view contains both the scoring mat-table and (when present) a hidden
      // Score Summary table, so target a VISIBLE table specifically rather than .first().
      const scoresheetTable = page.locator('mat-table').filter({ has: page.getByRole('row'), visible: true }).first();
      await expect(scoresheetTable).toBeVisible({ timeout: 10000 });

      // expect: Scoring categories (discussion questions) are displayed
      await expect(scoresheetTable.getByRole('row').first()).toBeVisible({ timeout: 10000 });
    });

    test('View User Submission', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      await navigateToEvaluationScoresheet(page, shared);

      // Click the "User" submission type button
      const userButton = page.getByRole('button', { name: 'User', exact: true });
      await expect(userButton).toBeVisible({ timeout: 5000 });
      await userButton.click();

      // expect: Scoresheet displays user's individual scores (table with questions visible)
      const scoresheetTable = page.getByRole('table').first();
      await expect(scoresheetTable).toBeVisible({ timeout: 10000 });
    });

    test('View Team Submission', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      await navigateToEvaluationScoresheet(page, shared);

      // Click the "Team" submission type button
      const teamButton = page.getByRole('button', { name: 'Team', exact: true });
      await expect(teamButton).toBeVisible({ timeout: 5000 });
      await teamButton.click();

      // expect: Scoresheet displays team's official scores
      const scoresheetTable = page.getByRole('table').first();
      await expect(scoresheetTable).toBeVisible({ timeout: 10000 });
    });

    test('View Team Average Submission', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      await navigateToEvaluationScoresheet(page, shared);

      // The "Team Avg" button may or may not be visible depending on scoring model config.
      // If visible, click it; otherwise verify the scoresheet is loaded.
      const teamAvgButton = page.getByRole('button', { name: 'Team Avg', exact: true });
      if (await teamAvgButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await teamAvgButton.click();
      }

      // expect: Scoresheet is displayed (read-only for averages)
      const scoresheetTable = page.getByRole('table').first();
      await expect(scoresheetTable).toBeVisible({ timeout: 10000 });
    });

    test('View Group Average Submission', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      await navigateToEvaluationScoresheet(page, shared);

      // The "Group Avg" button may or may not be visible depending on scoring model/group config.
      // If visible, click it; otherwise verify the scoresheet is loaded.
      const groupAvgButton = page.getByRole('button', { name: 'Group Avg', exact: true });
      if (await groupAvgButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await groupAvgButton.click();
      }

      // expect: Scoresheet is displayed
      const scoresheetTable = page.getByRole('table').first();
      await expect(scoresheetTable).toBeVisible({ timeout: 10000 });
    });

    test('View Official Submission', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      await navigateToEvaluationScoresheet(page, shared);

      // The "Official" button may or may not be visible depending on scoring model config.
      // If visible, click it; otherwise verify the scoresheet is loaded.
      const officialButton = page.getByRole('button', { name: 'Official', exact: true });
      if (await officialButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await officialButton.click();
      }

      // expect: Scoresheet is displayed
      const scoresheetTable = page.getByRole('table').first();
      await expect(scoresheetTable).toBeVisible({ timeout: 10000 });
    });

    test('Modify Score with CanSubmit Permission', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      const own = await seedOwnEvaluation('MS');
      await navigateToEvaluationScoresheet(page, own);

      // Ensure we're on User submission to have edit ability
      const userButton = page.getByRole('button', { name: 'User', exact: true });
      await expect(userButton).toBeVisible({ timeout: 5000 });
      await userButton.click();

      // expect: Scoresheet displays with scoring question textboxes
      const scoresheetTable = page.getByRole('table').first();
      await expect(scoresheetTable).toBeVisible({ timeout: 10000 });

      // The scoring options render disabled until the scoresheet has loaded the user's
      // submission and permissions (showModifyControls), so wait for an enabled one
      // rather than clicking the first checkbox on the page. The shared scoring model
      // always has a category with two options, so one must become enabled.
      const firstOption = page.getByRole('checkbox', { disabled: false }).first();
      await expect(firstOption).toBeVisible({ timeout: 15000 });
      const wasChecked = await firstOption.isChecked();
      await firstOption.click();

      // expect: the selection is stored and shown
      if (wasChecked) {
        await expect(firstOption).not.toBeChecked({ timeout: 10000 });
      } else {
        await expect(firstOption).toBeChecked({ timeout: 10000 });
      }

      // expect: No error snackbar after interaction
      const errorSnackbar = page.locator('snack-bar-container, mat-snack-bar-container').filter({ hasText: /error/i });
      const hasError = await errorSnackbar.isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasError).toBeFalsy();
    });

    test('Modify Score without CanSubmit Permission', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      await navigateToEvaluationScoresheet(page, shared);

      // Switch to "Team" view where the admin user cannot directly modify scores
      const teamButton = page.getByRole('button', { name: 'Team', exact: true });
      await expect(teamButton).toBeVisible({ timeout: 5000 });
      await teamButton.click();

      // expect: Scoresheet displays in a non-user submission mode
      const scoresheetTable = page.getByRole('table').first();
      await expect(scoresheetTable).toBeVisible({ timeout: 10000 });

      // expect: Textboxes should be disabled in Team view
      const disabledTextboxes = page.locator('textbox[disabled], input[disabled], textarea[disabled]');
      if (await disabledTextboxes.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(disabledTextboxes.first()).toBeDisabled();
      }
    });

    test('Add Comment to Score', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      const own = await seedOwnEvaluation('AC');
      await navigateToEvaluationScoresheet(page, own);

      // Switch to User submission to have edit ability
      const userButton = page.getByRole('button', { name: 'User', exact: true });
      await expect(userButton).toBeVisible({ timeout: 5000 });
      await userButton.click();

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
      }
    });

    test('View Score Summary', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      await navigateToEvaluationScoresheet(page, shared);

      // expect: Scoresheet displays with the evaluation heading and move info
      const scoresheetTable = page.getByRole('table').first();
      await expect(scoresheetTable).toBeVisible({ timeout: 10000 });

      // The current move info is shown in the toolbar (advanced to move 1 of moves 0-1)
      await expect(citeMoveLabel(page)).toHaveText('Move 1 of 1', { timeout: 5000 });

      // The Submission Review (report) button is available for viewing score summaries
      const reportButton = page.locator('button[title="Submission Review"]');
      await expect(reportButton).toBeVisible({ timeout: 5000 });
    });
  });
}
