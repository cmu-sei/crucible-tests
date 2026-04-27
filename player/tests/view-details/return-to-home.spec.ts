// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('View Details', () => {
  test('Return to Home from View', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in and navigate to a view
    await page.getByRole('link', { name: 'Project Lagoon TTX - Admin' }).click();

    // expect: User is on the view details page
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });

    // 2. Click the 'Player' link in the header
    await page.getByRole('link', { name: 'Player' }).click();

    // expect: User is navigated back to the home page
    // expect: The URL changes to '/'
    await expect(page).toHaveURL(/localhost:4301\/$/, { timeout: 10000 });

    // expect: The 'My Views' list is displayed
    await expect(page.getByText('My Views')).toBeVisible();
  });
});
