// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import {
  test,
  expect,
  Services,
  seedCompleteEvaluation,
  cleanupCompleteEvaluation,
  seedScoringModel,
  seedEvaluation,
  seedTeamType,
  seedTeam,
  CITE_THEMES,
  setCiteTheme,
} from '../../fixtures';
import { navigateToAdminSection, waitForAdminListLoad, recordWebSocketMessages } from '../../test-helpers';

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Administration - Evaluations`, () => {

    let evalName = '';
    let seedData: { scoringModelId: string; evaluationId: string; teamTypeId: string } | null = null;
    let otherSeedData: { scoringModelId: string; evaluationId: string; teamTypeId: string } | null = null;

    test('Manage Evaluation Teams', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      // 1. Seed a complete evaluation via API
      evalName = `Teams Test ${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      seedData = await seedCompleteEvaluation(evalName, 0);

      // 2. Navigate to the evaluations list
      await navigateToAdminSection(page, 'Evaluations');
      await waitForAdminListLoad(page, '/api/evaluations', true);

      // Search for the seeded evaluation
      const searchBox = page.locator('input[placeholder="Search"], input[type="search"], input[aria-label="Search"]').first();
      await expect(searchBox).toBeVisible({ timeout: 5000 });
      await searchBox.clear();
      await searchBox.fill(evalName);
      await page.waitForTimeout(1000);

      const evalRow = page.locator('tbody tr').filter({ hasText: evalName }).first();
      await expect(evalRow).toBeVisible({ timeout: 10000 });
      await evalRow.click();
      await page.waitForTimeout(1000);

      // 3. Find and expand the Teams panel
      const teamsPanelButton = page.getByRole('button', { name: 'Teams', exact: true });
      await expect(teamsPanelButton).toBeVisible({ timeout: 10000 });
      await teamsPanelButton.click();
      await page.waitForTimeout(1000);

      // 4. Verify the seeded team appears
      const teamItem = page.getByRole('button').filter({ hasText: `Team for ${evalName}` }).first();
      await expect(teamItem).toBeVisible({ timeout: 10000 });

      // 5. Expand the team: the seed adds Admin User without naming a role, and every team
      //    membership gets the Member role by default rather than none
      await teamItem.click();
      const memberRow = page.locator('app-admin-team-member-list').getByRole('row').filter({ hasText: 'Admin User' });
      await expect(memberRow.getByRole('combobox')).toHaveText('Member', { timeout: 10000 });
    });

    /**
     * The admin page is sent every team's new memberships live. An expanded team's member list
     * must show only that team's members, so Admin User put on another evaluation's team is
     * neither listed as a member here nor taken out of the users who can be added.
     */
    test('Team Members Stay with Their Team While Another Team Gains a Member', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);
      // Before the admin page opens its hub connection
      const hubMessages = recordWebSocketMessages(page);

      // 1. Seed an evaluation with a team that has no members
      const stamp = `${theme} ${Date.now()}`;
      evalName = `E2E Teams Live ${stamp}`;
      const scoringModelId = await seedScoringModel(`Test Scoring Model Teams Live ${stamp}`);
      const evaluationId = await seedEvaluation(scoringModelId, evalName);
      const teamTypeId = await seedTeamType(`Test Team Type Teams Live ${stamp}`);
      seedData = { scoringModelId, evaluationId, teamTypeId };
      const teamName = `Live Team ${stamp}`;
      await seedTeam(evaluationId, teamTypeId, teamName);

      // 2. Expand the team in the evaluation's Teams panel
      await navigateToAdminSection(page, 'Evaluations');
      await waitForAdminListLoad(page, '/api/evaluations', true);
      const searchBox = page.locator('input[placeholder="Search"], input[type="search"], input[aria-label="Search"]').first();
      await expect(searchBox).toBeVisible({ timeout: 5000 });
      await searchBox.fill(evalName);
      const evalRow = page.locator('tbody tr').filter({ hasText: evalName }).first();
      await expect(evalRow).toBeVisible({ timeout: 10000 });
      await evalRow.click();
      const teamsPanelButton = page.getByRole('button', { name: 'Teams', exact: true });
      await expect(teamsPanelButton).toBeVisible({ timeout: 10000 });
      await teamsPanelButton.click();
      const teamItem = page.getByRole('button').filter({ hasText: teamName }).first();
      await expect(teamItem).toBeVisible({ timeout: 10000 });
      await teamItem.click();

      const nonMembers = page.locator('app-admin-team-membership-list');
      await nonMembers.getByPlaceholder('Search').pressSequentially('Admin User');
      const adminNonMember = nonMembers.locator('tr').filter({ hasText: 'Admin User' });
      const adminMember = page.locator('app-admin-team-member-list tr').filter({ hasText: 'Admin User' });
      // expect: Admin User can be added, and is not a member
      await expect(adminNonMember).toHaveCount(1, { timeout: 10000 });
      await expect(adminMember).toHaveCount(0);

      // 3. Admin User is put on another evaluation's team while this team is expanded
      const other = await seedCompleteEvaluation(`E2E Teams Other ${stamp}`, 0);
      otherSeedData = other;
      // expect: The admin page is sent that membership
      await expect
        .poll(() => hubMessages.some((m) => m.includes('"TeamMembershipCreated"') && m.includes(other.teamId)), { timeout: 15000 })
        .toBe(true);

      // 4. expect: This team's lists are unchanged
      await expect(adminNonMember).toHaveCount(1);
      await expect(adminMember).toHaveCount(0);
    });

    test.afterEach(async () => {
      if (seedData) {
        await cleanupCompleteEvaluation(seedData);
        seedData = null;
      }
      if (otherSeedData) {
        await cleanupCompleteEvaluation(otherSeedData);
        otherSeedData = null;
      }
    });
  });
}
