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
  seedTeamMemberUser,
  cleanupTeamMemberUser,
  authenticateCiteWithKeycloak,
  CITE_THEMES,
  setCiteTheme,
  citeMoveLabel,
  type TeamMemberUser,
} from '../../fixtures';
import { navigateToAdminSection, findAdminRowByName } from '../../test-helpers';

/**
 * A team member sees moves up to the evaluation's current move, and the move list follows
 * the current move live, in both directions, over SignalR.
 *
 * The watching user is a temporary team member with the default Member role, not `admin`:
 * admin holds every system permission, reads every move, and so would show the future move
 * from the start. The move counter's "of N" is the highest move the member can see, which
 * makes the visible move list readable from the toolbar.
 */
for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Real-time Collaboration Features`, () => {
    let seeded: Awaited<ReturnType<typeof seedCompleteEvaluation>> | null = null;
    let member: TeamMemberUser | null = null;

    test('Real-time Move Advancement', async ({ citeAuthenticatedPage: adminPage, browser }) => {
      // Move 1 exists from the start; the evaluation is on move 0.
      const evalName = `E2E Move Advancement ${theme} ${Date.now()}`;
      seeded = await seedCompleteEvaluation(evalName, 1);
      member = await seedTeamMemberUser(seeded.teamId);

      // 1. Open two browser instances: the member on the evaluation, admin on its admin row
      // An empty storage state: the default for this suite is admin's saved sign-in
      const memberContext = await browser.newContext({ ignoreHTTPSErrors: true, storageState: { cookies: [], origins: [] } });
      try {
        const memberPage = await memberContext.newPage();
        await authenticateCiteWithKeycloak(memberPage, member.username, member.password);
        await setCiteTheme(memberPage, theme);
        await memberPage.goto(`${Services.Cite.UI}/?evaluation=${seeded.evaluationId}`);

        // expect: The member sees the current move and not the future move 1
        await expect(citeMoveLabel(memberPage)).toHaveText('Move 0 of 0', { timeout: 15000 });

        await setCiteTheme(adminPage, theme);
        await navigateToAdminSection(adminPage, 'Evaluations');
        const evalRow = await findAdminRowByName(adminPage, evalName);
        await expect(evalRow).toBeVisible({ timeout: 10000 });

        // 2. As admin, advance the evaluation to the next move
        await evalRow.locator('button[title="Increment Move"]').click();

        // 3. expect: Move 1 reaches the member without a refresh
        await expect(citeMoveLabel(memberPage)).toHaveText('Move 0 of 1', { timeout: 15000 });

        // 4. As admin, set the evaluation back to move 0
        await evalRow.locator('button[title="Decrement Move"]').click();

        // 5. expect: Move 1 is withdrawn from the member without a refresh
        await expect(citeMoveLabel(memberPage)).toHaveText('Move 0 of 0', { timeout: 15000 });
      } finally {
        await memberContext.close();
      }
    });

    test.afterEach(async () => {
      // The evaluation goes first: its teams hold the member's membership.
      if (seeded) {
        await cleanupCompleteEvaluation(seeded);
        seeded = null;
      }
      if (member) {
        await cleanupTeamMemberUser(member);
        member = null;
      }
    });
  });
}
