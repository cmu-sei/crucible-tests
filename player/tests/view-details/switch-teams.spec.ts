// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('View Details', () => {
  test('Switch Teams', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in and navigate to a view that has multiple teams
    await page.getByRole('link', { name: 'Project Lagoon TTX - Admin' }).click();

    // expect: User is on the view details page
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });
    await expect(page.getByText('Team:')).toBeVisible();

    // 2. Click the 'Select a Team' button
    await page.getByRole('button', { name: 'Select a Team' }).click();

    // expect: A dropdown menu appears showing all available teams for this view
    await expect(page.getByRole('menuitem', { name: 'Admin' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Exercise Control' })).toBeVisible();

    // 3. Click on a different team from the list
    await page.getByRole('menuitem', { name: 'Exercise Control' }).click();

    // expect: The current team updates to the selected team
    // expect: The team label shows the new team name
    await expect(page.getByRole('main').getByText('Exercise Control')).toBeVisible();

    // expect: The view content updates to reflect the selected team's context
    await expect(page.getByText('Team:')).toBeVisible();
  });
});
