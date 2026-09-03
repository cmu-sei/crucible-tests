// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

const INVALID_VIEW_ID = '00000000-0000-0000-0000-000000000000';

test.describe('Map Application', () => {
  // Guards the other half of the regression fix: legitimately invalid /
  // inaccessible views must STILL show "View Not Found" on the map route.
  test('Map shows "View Not Found" for an invalid view', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    // 1. Navigate to the Map application for a view id that does not exist
    await page.goto(`${Services.PlayerVM.UI}/views/${INVALID_VIEW_ID}/map`);

    // 2. The view-not-found page is shown
    await expect(
      page.getByRole('heading', { name: 'View Not Found' })
    ).toBeVisible({ timeout: 30000 });

    // 3. ...and the no-map message is not shown for a non-existent view
    await expect(
      page.getByRole('heading', { name: 'No Map is assigned to this Team' })
    ).toHaveCount(0);
  });
});
