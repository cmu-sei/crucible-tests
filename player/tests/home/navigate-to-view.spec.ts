// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, seededPrimaryViewName, findPlayerHomeViewLink } from '../../fixtures';

test.describe('Home Page - My Views', () => {
  test('Navigate to View', async ({ playerAuthenticatedPage: page }) => {
    const primaryViewName = seededPrimaryViewName();

    // 1. Log in as admin user
    // expect: User is on the home page with views displayed
    await expect(page.getByText('My Views')).toBeVisible();

    // 2. Click on a view name link
    await (await findPlayerHomeViewLink(page, primaryViewName)).click();

    // expect: User is navigated to the view details page
    // expect: The URL changes to /view/{viewId}
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });

    // expect: The page displays the view name in the header
    await expect(page.getByText(primaryViewName, { exact: true })).toBeVisible();

    // expect: The page shows team selector and view content
    await expect(page.getByRole('button', { name: 'Select a Team' })).toBeVisible();
    await expect(page.getByText('Team:')).toBeVisible();
  });
});
