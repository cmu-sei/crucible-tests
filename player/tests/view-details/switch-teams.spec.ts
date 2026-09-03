// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  Services,
  seededPrimaryViewName,
  findPlayerHomeViewLink,
  clickWithoutOverlayInterference,
} from '../../fixtures';

test.describe('View Details', () => {
  test('Switch Teams', async ({ playerAuthenticatedPage: page }) => {
    const primaryViewName = seededPrimaryViewName();

    // 1. Log in and navigate to a view that has multiple teams
    await (await findPlayerHomeViewLink(page, primaryViewName)).click();

    // expect: User is on the view details page
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });
    await expect(page.getByText('Team:')).toBeVisible();

    // 2. Click the 'Select a Team' button
    await clickWithoutOverlayInterference(page, page.getByRole('button', { name: 'Select a Team' }));

    // expect: A dropdown menu appears showing all available teams for this view
    await expect(page.getByRole('menuitem', { name: 'Admin' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Exercise Control' })).toBeVisible();

    // 3. Click on a different team from the list
    const setPrimaryTeamResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/users\/[^/]+\/teams\/[^/]+\/primary$/.test(response.url()),
      { timeout: 10000 }
    );
    await page.getByRole('menuitem', { name: 'Exercise Control' }).click();
    await setPrimaryTeamResponse;
    await page.waitForLoadState('load');

    // expect: The current team updates to the selected team
    // expect: The top bar team label shows the new team name after the reload
    await expect(page.getByText('Team:')).toBeVisible();
    await expect(page.locator('app-topbar span.team-text').first()).toHaveText('Exercise Control');

    // expect: The view content updates to reflect the selected team's context
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });
  });
});
