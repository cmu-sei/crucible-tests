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

    // expect: A bottom-sheet message explains why access failed
    await expect(page.getByRole('heading', { name: 'View Not Found' })).toBeVisible();
    await expect(
      page.getByText(
        'The view you are trying to access no longer exists or you do not have permission to access it.'
      )
    ).toBeVisible();

    // expect: The app returns the user to the home page
    await expect(page.getByText('My Views')).toBeVisible();
    await expect(page).not.toHaveURL(/\/view\//);
  });
});
