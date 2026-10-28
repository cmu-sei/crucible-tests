// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { request as pwRequest } from '@playwright/test';
import {
  test,
  expect,
  Services,
  ensureScoringModelExists,
  seedEvaluation,
  seedMove,
  seedTeamType,
  seedTeam,
  seedTeamMemberUser,
  cleanupTeamMemberUser,
  apiDeleteEvaluation,
  apiDeleteTeamType,
  getCiteApiToken,
  authenticateCiteWithKeycloak,
  CITE_THEMES,
  setCiteTheme,
  citeMoveLabel,
  type TeamMemberUser,
} from '../../fixtures';

/** Set an evaluation's current move as admin. */
async function setCurrentMove(evaluationId: string, moveNumber: number): Promise<void> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getCiteApiToken(apiContext);
    const response = await apiContext.put(`${Services.Cite.API}/api/evaluations/${evaluationId}/move/${moveNumber}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok()) {
      throw new Error(`Failed to set evaluation ${evaluationId} to move ${moveNumber}: ${response.status()} ${await response.text()}`);
    }
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Official scores are read by team role permission alone. The default Member role holds
 * ViewPastOfficialScore but neither ViewCurrentOfficialScore nor EditOfficialScore, so a
 * member sees the official score of a past move and not of the current one, even on a team
 * type marked Official Score Contributor, which used to grant the current move's.
 *
 * The scoresheet offers the Official toggle only when the official submission for the
 * displayed move is among the submissions the API returned, so the toggle shows what the
 * member was allowed to read. The member is a temporary user, because `admin` holds every
 * system permission.
 */
for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Scoresheet Interface`, () => {
    let evaluationId = '';
    let teamTypeId = '';
    let member: TeamMemberUser | null = null;

    test('View Official Submission by Team Role', async ({ browser }) => {
      // The shared model uses official scores and has a scoring category; the evaluation
      // gets its own copy, so the shared model is left in place.
      const scoringModelId = await ensureScoringModelExists();
      evaluationId = await seedEvaluation(scoringModelId, `E2E Official By Role ${theme} ${Date.now()}`);
      await seedMove(evaluationId, 1);
      await setCurrentMove(evaluationId, 1);
      teamTypeId = await seedTeamType(`Test Team Type Official ${theme} ${Date.now()}`, { isOfficialScoreContributor: true });
      const teamId = await seedTeam(evaluationId, teamTypeId, `Official Team ${theme}`);
      member = await seedTeamMemberUser(teamId);

      // An empty storage state: the default for this suite is admin's saved sign-in
      const memberContext = await browser.newContext({ ignoreHTTPSErrors: true, storageState: { cookies: [], origins: [] } });
      try {
        const page = await memberContext.newPage();
        await authenticateCiteWithKeycloak(page, member.username, member.password);
        await setCiteTheme(page, theme);

        // Open on the scoresheet with the member's team active, as the app saves it itself
        await page.addInitScript(
          ({ evalId, team }) => {
            const state = JSON.parse(window.localStorage.getItem('uiState') ?? '{}');
            state.evaluationSection = { ...state.evaluationSection, [evalId]: 'scoresheet' };
            state.evaluationTeam = { ...state.evaluationTeam, [evalId]: team };
            state.evaluationSubmissionType = { ...state.evaluationSubmissionType, [evalId]: 'team' };
            window.localStorage.setItem('uiState', JSON.stringify(state));
          },
          { evalId: evaluationId, team: teamId },
        );
        const submissionsLoaded = page.waitForResponse(
          (r) => r.url().includes(`/api/evaluations/${evaluationId}/`) && r.url().includes('submissions') && r.ok(),
        );
        await page.goto(`${Services.Cite.UI}/?evaluation=${evaluationId}&section=scoresheet`);
        await submissionsLoaded;

        // 1. On the current move the scoresheet is shown without an official score
        await expect(citeMoveLabel(page)).toHaveText('Move 1 of 1', { timeout: 15000 });
        await expect(page.getByRole('button', { name: 'Team', exact: true })).toBeVisible({ timeout: 15000 });
        // expect: Member holds no current official score permission, so no Official toggle
        await expect(page.getByRole('button', { name: 'Official', exact: true })).toHaveCount(0);

        // 2. Display the previous move
        await page.getByRole('button', { name: 'Decrement Displayed Move' }).click();
        await expect(citeMoveLabel(page)).toHaveText('Move 0 of 1', { timeout: 10000 });

        // expect: Member holds ViewPastOfficialScore, so the past move's official score is offered
        await expect(page.getByRole('button', { name: 'Official', exact: true })).toBeVisible({ timeout: 10000 });
      } finally {
        await memberContext.close();
      }
    });

    test.afterEach(async () => {
      // The evaluation goes first: its team holds the member's membership and uses the team type.
      if (evaluationId) {
        await apiDeleteEvaluation(evaluationId);
        evaluationId = '';
      }
      if (teamTypeId) {
        await apiDeleteTeamType(teamTypeId);
        teamTypeId = '';
      }
      if (member) {
        await cleanupTeamMemberUser(member);
        member = null;
      }
    });
  });
}
