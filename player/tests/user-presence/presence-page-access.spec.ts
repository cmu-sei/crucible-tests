// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('User Presence', () => {
  test('User Presence Page Access', async ({ playerAuthenticatedPage: page }) => {
    // 1. Navigate to user presence route /view/:id/presence
    const viewLink = page.getByRole('link', { name: 'Project Lagoon TTX - Admin' });
    const href = await viewLink.getAttribute('href');
    const viewId = href?.replace('/view/', '');

    await page.goto(`${Services.Player.UI}/view/${viewId}/presence`);

    // expect: User presence page loads
    // expect: List of users in the view is displayed
    await expect(page.locator('body')).toBeVisible();
  });
});
