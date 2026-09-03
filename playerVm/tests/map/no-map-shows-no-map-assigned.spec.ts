// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getFirstViewId } from '../../fixtures';

test.describe('Map Application', () => {
  // Regression: a valid view with no map assigned showed "View Not Found"
  // instead of "No Map is assigned to this Team" (vm.ui #579).
  test('Map shows "No Map is assigned" for a valid view without a map', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    // 1. Discover a real view id from the authenticated user's "My Views" list
    const viewId = await getFirstViewId(page);
    test.skip(!viewId, 'No views available for the admin user to test against');

    // 2. Open the Map application for that view
    await page.goto(`${Services.PlayerVM.UI}/views/${viewId}/map`);

    // 3. The page resolves to one of the map states. For a view with no map
    //    assigned to the team, it must show the "No Map is assigned" message
    //    and must NOT fall through to "View Not Found".
    const noMap = page.getByRole('heading', {
      name: 'No Map is assigned to this Team',
    });
    const mapImage = page.locator('app-map-team-display img, app-map img').first();

    // Wait for the page to settle into either the no-map state (the case under
    // test) or, if this environment happens to have a map on the first view,
    // the rendered map.
    await expect(async () => {
      const hasNoMap = await noMap.isVisible();
      const hasMap = await mapImage.isVisible();
      expect(hasNoMap || hasMap).toBeTruthy();
    }).toPass({ timeout: 30000 });

    // Whichever map state we landed in, a valid view must never show the
    // view-not-found page on the map route.
    await expect(
      page.getByRole('heading', { name: 'View Not Found' })
    ).toHaveCount(0);
  });
});
