// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoPlayerVm, PLAYERVM_THEMES } from '../../fixtures';

for (const theme of PLAYERVM_THEMES) {
  test.describe(`${theme} theme › Map Application`, () => {
    // Regression: a valid view with no map assigned showed "View Not Found"
    // instead of "No Map is assigned to this Team" (vm.ui #579).
    test('Map shows "No Map is assigned" for a valid view without a map', async ({
      playerVmAuthenticatedPage: page,
      playerVmView: view,
    }) => {
      // 1. Open the Map application for a freshly seeded view, which has no map
      await gotoPlayerVm(page, `/views/${view.id}/map`, theme);

      // 2. The no-map message is shown...
      await expect(
        page.getByRole('heading', { name: 'No Map is assigned to this Team' })
      ).toBeVisible({ timeout: 30000 });

      // 3. ...and a valid view never falls through to the view-not-found page
      await expect(page.getByRole('heading', { name: 'View Not Found' })).toHaveCount(0);
    });
  });
}
