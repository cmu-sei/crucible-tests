// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Home Page - My Views', () => {
  test('Navigate to View', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin user
    // expect: User is on the home page with views displayed
    await expect(page.getByText('My Views')).toBeVisible();

    // 2. Click on a view name link
    await page.getByRole('link', { name: 'Project Lagoon TTX - Admin' }).click();

    // expect: User is navigated to the view details page
    // expect: The URL changes to /view/{viewId}
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });

    // expect: The page displays the view name in the header
    await expect(page.getByText('Project Lagoon TTX - Admin User')).toBeVisible();

    // expect: The page shows team selector and view content
    await expect(page.getByRole('button', { name: 'Select a Team' })).toBeVisible();
    await expect(page.getByText('Team:')).toBeVisible();
  });
});
