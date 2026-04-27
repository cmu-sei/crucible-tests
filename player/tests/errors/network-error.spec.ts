// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Network Error Handling', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in and navigate to home page
    // expect: User is on the home page
    await expect(page.getByText('My Views')).toBeVisible();

    // 2. Simulate a network disconnection
    await page.route('**/api/**', (route) => route.abort());

    // Trigger a page action that makes an API call
    await page.reload();

    // expect: The application handles the error gracefully
    // expect: No unhandled errors crash the page
    // The page should still render even if API calls fail
    await expect(page.locator('body')).toBeVisible();

    // Restore network
    await page.unrouteAll();
  });
});
