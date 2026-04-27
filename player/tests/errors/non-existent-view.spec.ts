// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Navigate to Non-Existent View', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin user
    // expect: User is authenticated
    await expect(page.getByText('My Views')).toBeVisible();

    // 2. Navigate to /view/00000000-0000-0000-0000-000000000000 (invalid view ID)
    await page.goto(`${Services.Player.UI}/view/00000000-0000-0000-0000-000000000000`);

    // expect: An error message is displayed
    // expect: User is informed the view does not exist or they don't have access
    // expect: User can navigate back to home
    // The app shows a "Not Found" dialog with "View not found" message
    await expect(page.getByRole('heading', { name: 'Not Found' }).first()).toBeVisible({ timeout: 10000 });
  });
});
