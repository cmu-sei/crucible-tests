// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoPlayerVm, PLAYERVM_THEMES } from '../../fixtures';
import { seedView } from '../../vm-helpers';

for (const theme of PLAYERVM_THEMES) {
  test.describe(`${theme} theme › Map Application`, () => {
    // A freshly seeded view has no maps, which is exactly the state under test.
    // Seeded per theme so the light and dark runs each get their own view.
    // Discovering a view instead would leave the assertion at the mercy of the
    // environment: a discovered view might already have a map.
    let seeded: Awaited<ReturnType<typeof seedView>>;

    test.beforeAll(async () => {
      seeded = await seedView(`E2E No Map ${theme}`);
    });

    test.afterAll(async () => {
      await seeded?.cleanup();
    });

    // Regression: a valid view with no map assigned showed "View Not Found"
    // instead of "No Map is assigned to this Team" (vm.ui #579).
    test('Map shows "No Map is assigned" for a valid view without a map', async ({
      playerVmAuthenticatedPage: page,
    }) => {
      // 1. Open the Map application for the seeded view, which has no map
      await gotoPlayerVm(page, `/views/${seeded.viewId}/map`, theme);

      // 2. The no-map message is shown. Reaching it also proves the view
      //    resolved: map-main renders app-page-not-found whenever it cannot find
      //    a primary team for the view.
      await expect(
        page.getByRole('heading', { name: 'No Map is assigned to this Team' })
      ).toBeVisible({ timeout: 30000 });

      // 3. ...and a valid view never falls through to the view-not-found page
      await expect(page.getByRole('heading', { name: 'View Not Found' })).toHaveCount(0);
    });
  });
}
