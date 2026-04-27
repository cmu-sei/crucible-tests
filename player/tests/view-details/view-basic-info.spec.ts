// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('View Details', () => {
  test('View Basic Information', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in and navigate to a view
    await page.getByRole('link', { name: 'Project Lagoon TTX - Admin' }).click();

    // expect: User is on the view details page
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });

    // 2. Observe the view header
    // expect: View name is displayed
    await expect(page.getByText('Project Lagoon TTX - Admin User')).toBeVisible();

    // expect: Current team is shown with 'Team:' label
    await expect(page.getByText('Team:')).toBeVisible();

    // expect: Team selector dropdown is available
    await expect(page.getByRole('button', { name: 'Select a Team' })).toBeVisible();

    // expect: Users button is visible
    await expect(page.getByRole('button', { name: 'Users' })).toBeVisible();

    // expect: Menu button is visible
    await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();

    // expect: Notifications button is visible
    await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible();
  });
});
