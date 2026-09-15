// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { seedView } from '../../vm-helpers';

test.describe('Map Application', () => {
  // A freshly seeded view has no maps, which is exactly the state under test.
  // Discovering a view instead would leave the assertion at the mercy of the
  // environment: a discovered view might already have a map, which is why this
  // spec used to accept either the no-map message or a rendered map and so could
  // pass without ever exercising the no-map path.
  let seeded: Awaited<ReturnType<typeof seedView>>;

  test.beforeAll(async () => {
    seeded = await seedView('E2E No Map');
  });

  test.afterAll(async () => {
    await seeded?.cleanup();
  });

  // Regression: a valid view with no map assigned showed "View Not Found"
  // instead of "No Map is assigned to this Team" (vm.ui #579).
  test('Map shows "No Map is assigned" for a valid view without a map', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    // 1. Open the Map application for the seeded view
    await page.goto(`${Services.PlayerVM.UI}/views/${seeded.viewId}/map`);

    // 2. The view exists and has no map, so the page must settle on the no-map
    //    message. Reaching it also proves the view resolved: map-main renders
    //    app-page-not-found whenever it cannot find a primary team for the view.
    await expect(
      page.getByRole('heading', { name: 'No Map is assigned to this Team' })
    ).toBeVisible({ timeout: 30000 });

    // 3. And it must never fall through to the view-not-found page.
    await expect(
      page.getByRole('heading', { name: 'View Not Found' })
    ).toHaveCount(0);
  });
});
